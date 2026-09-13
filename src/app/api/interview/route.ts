import { NextResponse } from "next/server";
import {
  DEFAULT_LANGUAGE,
  isLanguage,
  languageLabel,
  type Language,
} from "@/lib/languages";
import { getProblem } from "@/lib/problems-store";
import type { Problem } from "@/lib/problems";
import {
  aiProviderLabel,
  aiProviderToApiKeyProvider,
  DEFAULT_AI_PROVIDER,
  generateText,
  isAiProvider,
  isProviderQuotaError,
  type AiProvider,
  type ChatTurn,
} from "@/lib/ai";
import { mentionsComplexity } from "@/lib/grading";
import type { ExecutionResult } from "@/lib/execute";
import { looksRandom } from "@/lib/noise";
import { getCurrentUserApiKey } from "@/lib/users";

const MOCK_REPLIES = [
  "Sounds good — before you dive into code, can you walk me through your approach and its time complexity?",
  "Okay, I like that direction. Go ahead and start coding it up — talk me through any tricky parts as you go.",
  "Good progress. What happens with your current approach on an edge case, like an empty input or duplicate values?",
  "Nice, that handles it. Once you think you're done, hit Run to check it against the test cases.",
  "Walk me through why you picked this data structure over the alternatives.",
];

/**
 * What to say when the transcript was clearly noise rather than speech. Asking
 * them to repeat is the honest response — the old behavior answered unheard
 * audio with a stock complexity question, which read as the interviewer
 * ignoring them. Rotated so a run of bad audio doesn't repeat one line.
 */
const NOT_CAUGHT_REPLIES = [
  "Sorry, I didn't catch that — could you say it again?",
  "That came through garbled on my end. Mind repeating it?",
  "I missed that one. Say it once more?",
];

/** What the candidate did in the editor, when it wasn't them talking. */
type InterviewEvent = "run" | "code-review" | "periodic-check";

/** Whether the candidate was writing code or doing nothing during a periodic check's window. */
type ActivitySinceLastCheck = "idle" | "typing";

/** The model's way of saying a periodic check found nothing worth interrupting for. */
const NO_COMMENT = "NONE";

/**
 * Whether a periodic check came back as "nothing to say". An exact match is too
 * strict — models routinely wrap the word in quotes or trail it with a period,
 * and any near-miss used to be appended to the transcript and read aloud as
 * the single word "NONE". Stripping the decoration can't turn a real reply into
 * a false positive, since anything longer still won't equal NONE.
 */
function isNoComment(reply: string): boolean {
  return reply.replace(/[\s"'“”*_.!]/g, "").toUpperCase() === NO_COMMENT;
}

/**
 * Scripted fallback used when a periodic check can't reach the model, so the
 * feature is still visible without a key/quota. Deliberately carries no
 * "scripted" marker in its text: this reply is spoken by TTS, and the client
 * already shows a `mocked`/`reason` badge next to it.
 */
const CHECK_IN_MOCK_REPLY: Record<ActivitySinceLastCheck, string> = {
  idle: "You've gone quiet for a bit — want to talk me through your current thinking, or where you're stuck?",
  typing:
    "Take a second to trace your current approach against the examples above — does it actually hold up on all of them?",
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

type TimerInfo = { mode: "countup" | "strict"; minutes?: number; remainingSeconds?: number };

/**
 * The mechanics of the session, so questions like "what's my limit?" or "can I
 * switch languages?" get a real answer. Without this Alex has no idea a clock
 * or a Run button even exists, so it classifies fair questions as off-topic.
 */
function describeSetup(timer: TimerInfo | undefined, language: Language): string {
  let time = "No time limit — the clock counts up and they submit when ready.";
  if (timer?.mode === "strict") {
    const limit = timer.minutes ?? 0;
    const left =
      typeof timer.remainingSeconds === "number"
        ? ` About ${Math.max(0, Math.ceil(timer.remainingSeconds / 60))} minute(s) left.`
        : "";
    time = `A strict ${limit}-minute limit that auto-submits at zero.${left}`;
  }

  return `Interview setup — answer questions about any of this directly:
- Time: ${time}
- They can press Run at any point to execute their code against the test cases shown in the problem.
- They can switch language from the picker above the editor; they're currently in ${languageLabel(language)}.
- Submitting ends the interview and produces a scored report.
- You cannot see their screen or face, only their editor contents and what they say.`;
}

/**
 * Complexity analysis is a scored dimension, but every other mention of it in
 * this prompt is conditional ("if their code has a complexity problem", "if
 * every test passed"), so a talkative candidate who never gets a green run
 * could finish without the question ever being asked — and then be marked down
 * for it. Whether it has already come up is computed here rather than left to
 * the model to notice, which is also what stops it from asking twice.
 */
function complexityDirective(turns: ChatTurn[], timer: TimerInfo | undefined): string {
  if (turns.some((turn) => mentionsComplexity(turn.text))) {
    return `Time and space complexity has already come up in this conversation. Don't
  ask for it again unless they switch approach and the answer would change.`;
  }

  const nearlyOver =
    timer?.mode === "strict" &&
    typeof timer.remainingSeconds === "number" &&
    timer.remainingSeconds <= 5 * 60;

  if (nearlyOver) {
    return `Complexity has NOT come up yet and there are only a few minutes left. Ask
  them for the time and space complexity of their approach in this reply, before
  the clock runs out — it is scored, and an unasked question costs them.`;
  }

  return `Complexity has NOT come up yet. Once they've settled on an approach — you
  don't need working code first — ask them for its time and space complexity.
  Do not let the interview end without having asked at least once.`;
}

function buildSystemInstruction(
  problem: Problem,
  code: string,
  testResult: ExecutionResult | null,
  language: Language,
  timer: TimerInfo | undefined,
  turns: ChatTurn[]
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
${describeSetup(timer, language)}

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
- ${complexityDirective(turns, timer)}
- Do not repeat the full problem statement back to them.

When their message isn't a direct answer about the problem, respond to what it
actually was — never fall back on a stock sentence, and never ask about
complexity as a way of dodging something you didn't follow:
- Asking about the interview itself (time left, running code, switching language,
  what submitting does): answer it from the setup above in one line, then hand the
  floor back to them.
- Something you genuinely couldn't parse: say you didn't catch it and ask them to
  repeat. Do not guess at what they meant, and do not change the subject.
- A misunderstanding of the problem or of something you said: correct it plainly
  and briefly, then point them back to where they were.
- Actually off-topic: acknowledge it in a few words and steer back to the specific
  thing they were last working on — the function they're mid-way through, the
  failing case, the approach they just described. Phrase it differently each time.
- Small talk or a brief aside: a short human reply is fine before returning to the
  problem. You don't have to interrogate every message.`;
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
  const { problemId, history, code, testResult, event, activity, language, timer, provider } = body as {
    problemId?: string;
    history?: ChatTurn[];
    code?: string;
    testResult?: ExecutionResult | null;
    event?: InterviewEvent;
    activity?: ActivitySinceLastCheck;
    language?: string;
    timer?: TimerInfo;
    provider?: AiProvider;
  };
  const aiProvider = isAiProvider(provider) ? provider : DEFAULT_AI_PROVIDER;

  if (!problemId) {
    return NextResponse.json({ error: "problemId is required." }, { status: 400 });
  }

  // Independent lookups: the problem fetch and the candidate's own API key
  // for this provider don't depend on each other, so run them concurrently.
  const [problem, userApiKey] = await Promise.all([
    getProblem(problemId),
    getCurrentUserApiKey(aiProviderToApiKeyProvider(aiProvider)),
  ]);
  if (!problem) {
    return NextResponse.json({ error: "Unknown problem." }, { status: 404 });
  }

  const turns = history ?? [];
  const userTurnCount = turns.filter((turn) => turn.role === "user").length;
  const lastUserTurn = turns.filter((turn) => turn.role === "user").at(-1);

  // Noise shouldn't drive the interview — or cost a model call. Asking them to
  // repeat is the honest answer to audio we couldn't make out.
  if (!event && lastUserTurn && looksRandom(lastUserTurn.text)) {
    return NextResponse.json({
      reply: NOT_CAUGHT_REPLIES[userTurnCount % NOT_CAUGHT_REPLIES.length],
      mocked: false,
      deflected: true,
    });
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
      aiProvider,
      buildSystemInstruction(
        problem,
        code ?? "",
        testResult ?? null,
        isLanguage(language) ? language : DEFAULT_LANGUAGE,
        timer,
        turns
      ),
      contents,
      userApiKey
    );
    if (reply) {
      // A periodic check that found nothing wrong stays silent rather than
      // interrupting with idle praise every two minutes.
      if (event === "periodic-check" && isNoComment(reply)) {
        return NextResponse.json({ reply: null, mocked: false });
      }
      // Flagged rather than prefixed with a label: the client adds the visible
      // tag for display, so the tag never reaches text-to-speech.
      return NextResponse.json({
        reply,
        mocked: false,
        ...(event === "periodic-check" ? { checkIn: true } : {}),
      });
    }
  } catch (err) {
    console.error(`${aiProviderLabel(aiProvider)} interview call failed, falling back to mock:`, err);
    // A quota bounce is the common case, and it looks exactly like the
    // interviewer ignoring the candidate's code, so report which it was.
    quotaHit = isProviderQuotaError(aiProvider, err);
  }

  // The periodic checker gets a scripted stand-in so it's visible in testing
  // even without a working model call — flagged `mocked` so the UI marks it
  // as such. Everything else stays quiet, since there's no canned line that
  // could reflect their code.
  if (event === "periodic-check") {
    return NextResponse.json({
      reply: CHECK_IN_MOCK_REPLY[activity ?? "idle"],
      mocked: true,
      checkIn: true,
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

  // Cycles rather than clamping to the last entry: clamping meant a long
  // interview without a working model call repeated one sentence on every single turn.
  const reply =
    userTurnCount === 0
      ? `Hi, I'm Alex, your interviewer today. Let's look at "${problem.title}". Take a look at the problem and tell me how you'd approach it.`
      : MOCK_REPLIES[(userTurnCount - 1) % MOCK_REPLIES.length];

  return NextResponse.json({
    reply,
    mocked: true,
    ...(quotaHit ? { reason: "quota" } : {}),
  });
}
