import { NextResponse } from "next/server";
import {
  DEFAULT_LANGUAGE,
  isLanguage,
  languageLabel,
  type Language,
} from "@/lib/languages";
import { getProblem } from "@/lib/problems";
import { generateText, isQuotaError, type ChatTurn } from "@/lib/gemini";
import type { ExecutionResult } from "@/lib/execute";
import { looksRandom } from "@/lib/noise";

const MOCK_REPLIES = [
  "Sounds good — before you dive into code, can you walk me through your approach and its time complexity?",
  "Okay, I like that direction. Go ahead and start coding it up — talk me through any tricky parts as you go.",
  "Good progress. What happens with your current approach on an edge case, like an empty input or duplicate values?",
  "Nice, that handles it. Once you think you're done, hit Run to check it against the test cases.",
  "Makes sense. Is there anything you'd change about the time or space complexity if the input were much larger?",
];

/**
 * The reply for anything that isn't a real answer — mic noise, filler, or an
 * off-topic remark. Steering back to complexity beats reacting to nonsense.
 * Kept as a backstop for whatever slips past the client-side noise filter
 * (e.g. a fluent but off-topic sentence, which looksRandom can't catch).
 */
const DEFLECT_REPLY =
  "Makes sense. Is there anything you'd change about the time or space complexity if the input were much larger?";

/** What the candidate did in the editor, when it wasn't them talking. */
type InterviewEvent = "run" | "code-review" | "periodic-check";

/** Whether the candidate was writing code or doing nothing during a periodic check's window. */
type ActivitySinceLastCheck = "idle" | "typing";

/** The model's way of saying a periodic check found nothing worth interrupting for. */
const NO_COMMENT = "NONE";

/** Visible tag so a periodic direction-check message is obviously not a normal reply. */
const CHECK_IN_LABEL = "🧭 [2-min check-in] ";

/** Scripted fallback used when a periodic check can't reach Gemini, so the feature is still visible without a key/quota. */
const CHECK_IN_MOCK_REPLY: Record<ActivitySinceLastCheck, string> = {
  idle: `${CHECK_IN_LABEL}(scripted — no live Gemini) You've gone quiet for a bit — want to talk me through your current thinking, or where you're stuck?`,
  typing: `${CHECK_IN_LABEL}(scripted — no live Gemini) Take a second to trace your current approach against the examples above — does it actually hold up on all of them?`,
};

function describeTestResult(result: ExecutionResult): string {
  if (result.crashed) {
    return `Their code crashed:\n${result.crashOutput ?? "(no output)"}`;
  }

  const failures = result.results
    .filter((test) => !test.passed)
    .slice(0, 3)
    .map(
      (test) =>
        `  input=${JSON.stringify(test.args)} expected=${JSON.stringify(test.expected)} got=${JSON.stringify(test.actual)}${test.error ? ` (${test.error})` : ""}`
    )
    .join("\n");

  return [
    `Tests: ${result.passed}/${result.total} passed.`,
    failures ? `Failing cases:\n${failures}` : "Every case passed.",
  ].join("\n");
}

function buildSystemInstruction(
  problem: NonNullable<ReturnType<typeof getProblem>>,
  code: string,
  testResult: ExecutionResult | null,
  language: Language
) {
  return `You are Alex, a friendly but rigorous AI technical interviewer conducting a live coding interview.

Problem: ${problem.title} (${problem.difficulty})
${problem.description}

The candidate is solving it in ${languageLabel(language)}. Their editor contains
exactly this, right now:
\`\`\`${language}
${code.trim() || "(the editor is still empty)"}
\`\`\`
${testResult ? `\nMost recent run of that code:\n${describeTestResult(testResult)}\n` : ""}
Guidelines:
- Keep replies short and conversational (2-4 sentences), like a real spoken interview.
- This reply is spoken aloud by text-to-speech, not rendered as text. Never use
  LaTeX or markdown math (no $...$, no ^ for exponents, no \\times or \\cdot).
  Say complexity the way you'd say it out loud: "O of n squared", "O of n log n",
  "constant time" — plain words, not symbols.
- You can see the editor. Ground your feedback in what is actually written there:
  name the variable, function, loop or missing branch you mean, and comment on
  changes they've made since your last message. Never claim you cannot see their code.
- If the code is empty or unchanged, ask about their approach instead of inventing detail.
- Judge it as ${languageLabel(language)} code: use that language's idioms, standard
  library and pitfalls, and never suggest another language's syntax.
- Point out real bugs, missing edge cases and complexity problems in their code, but
  nudge — ask a question that leads them to it rather than handing over the fix.
- Ask the candidate to explain their approach before or while they code.
- Do not repeat the full problem statement back to them.
- If the candidate's latest message is unintelligible, filler, or unrelated to the
  interview, reply with exactly this and nothing else: "${DEFLECT_REPLY}"`;
}

/** The turn that stands in for the candidate when the editor is what changed. */
function eventPrompt(
  event: InterviewEvent,
  testResult: ExecutionResult | null,
  activity?: ActivitySinceLastCheck
): string {
  if (event === "run") {
    return `[The candidate just ran their code against the test cases.
${testResult ? describeTestResult(testResult) : "No results came back."}
React to this specific result. If cases fail, point at the case and the part of
their code responsible without writing the fix for them. If everything passes,
acknowledge it briefly and probe complexity or an edge case the tests miss.]`;
  }

  if (event === "periodic-check") {
    const shared = `Never write or dictate the corrected code and never state the final
fix outright — at most, name the concept, data structure, or edge case they're
missing and ask a question that points them at it. If you have nothing worth
interrupting for, reply with exactly "${NO_COMMENT}" and nothing else.`;

    if (activity === "typing") {
      return `[Two minutes have passed. The candidate has been typing in the editor
this whole time without saying anything out loud. Look at the current editor
contents above and judge whether their implementation is actually heading
toward a correct solution. If it's the wrong approach, has a real logic bug, or
will blow up in complexity, say so and nudge them toward the fix. ${shared}]`;
    }

    return `[Two minutes have passed with no typing and no talking — the candidate
has gone quiet. Look at whatever is currently in the editor (it may be
unchanged from before, or still the starter code). If what's there suggests
they're heading down the wrong path, or they seem stuck without having
committed to an approach, say so and ask a guiding question to get them moving
again. ${shared}]`;
  }

  return `[The candidate has been writing code without saying anything. Look at the
editor contents above and give one short, specific observation or question about
what they have written so far — reference the actual code. If it looks correct,
ask about an edge case or the complexity. Don't repeat feedback you've already given.]`;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { problemId, history, code, testResult, event, activity, language } = body as {
    problemId?: string;
    history?: ChatTurn[];
    code?: string;
    testResult?: ExecutionResult | null;
    event?: InterviewEvent;
    activity?: ActivitySinceLastCheck;
    language?: string;
  };

  if (!problemId) {
    return NextResponse.json({ error: "problemId is required." }, { status: 400 });
  }

  const problem = getProblem(problemId);
  if (!problem) {
    return NextResponse.json({ error: "Unknown problem." }, { status: 404 });
  }

  const turns = history ?? [];
  const lastUserTurn = turns.filter((turn) => turn.role === "user").at(-1);

  // Noise shouldn't drive the interview — or cost a model call.
  if (!event && lastUserTurn && looksRandom(lastUserTurn.text)) {
    return NextResponse.json({ reply: DEFLECT_REPLY, mocked: false, deflected: true });
  }

  const contents: ChatTurn[] = event
    ? [...turns, { role: "user", text: eventPrompt(event, testResult ?? null, activity) }]
    : turns.length > 0
      ? turns
      : [
          {
            role: "user",
            text: "The interview is starting. Greet the candidate and introduce the problem briefly.",
          },
        ];

  let quotaHit = false;
  try {
    const reply = await generateText(
      buildSystemInstruction(
        problem,
        code ?? "",
        testResult ?? null,
        isLanguage(language) ? language : DEFAULT_LANGUAGE
      ),
      contents
    );
    if (reply) {
      // A periodic check that found nothing wrong stays silent rather than
      // interrupting with idle praise every two minutes.
      if (event === "periodic-check" && reply.trim().toUpperCase() === NO_COMMENT) {
        return NextResponse.json({ reply: null, mocked: false });
      }
      // Tagged so it's unmistakable in the transcript which messages came from
      // the periodic checker versus the regular back-and-forth.
      const taggedReply = event === "periodic-check" ? `${CHECK_IN_LABEL}${reply}` : reply;
      return NextResponse.json({ reply: taggedReply, mocked: false });
    }
  } catch (err) {
    console.error("Gemini interview call failed, falling back to mock:", err);
    // A quota bounce is the common case, and it looks exactly like the
    // interviewer ignoring the candidate's code, so report which it was.
    quotaHit = isQuotaError(err);
  }

  // The periodic checker gets a scripted, clearly-labeled stand-in so it's
  // visible in testing even without a working Gemini call — everything else
  // stays quiet, since there's no canned line that could reflect their code.
  if (event === "periodic-check") {
    return NextResponse.json({
      reply: CHECK_IN_MOCK_REPLY[activity ?? "idle"],
      mocked: true,
      reason: quotaHit ? "quota" : "unavailable",
    });
  }

  if (event) {
    return NextResponse.json({
      reply: null,
      mocked: true,
      reason: quotaHit ? "quota" : "unavailable",
    });
  }

  if (quotaHit) {
    return NextResponse.json({ reply: DEFLECT_REPLY, mocked: true, reason: "quota" });
  }

  const turnCount = turns.filter((t) => t.role === "user").length;
  const mockIndex = Math.min(turnCount, MOCK_REPLIES.length - 1);
  const reply =
    turnCount === 0
      ? `Hi, I'm Alex, your interviewer today. Let's look at "${problem.title}". Take a look at the problem and tell me how you'd approach it.`
      : MOCK_REPLIES[mockIndex];

  return NextResponse.json({ reply, mocked: true });
}
