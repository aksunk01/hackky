import { NextResponse } from "next/server";
import { getProblem } from "@/lib/problems";
import { generateText, isQuotaError, type ChatTurn } from "@/lib/gemini";
import type { ExecutionResult } from "@/lib/execute";

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
 */
const DEFLECT_REPLY =
  "Makes sense. Is there anything you'd change about the time or space complexity if the input were much larger?";

/** Words that carry no interview content on their own. */
const FILLER_WORDS = new Set([
  "um", "uh", "erm", "hmm", "mhm", "huh", "ah", "oh", "eh",
  "ok", "okay", "yeah", "yep", "yes", "no", "nope", "nah", "sure", "right",
  "hi", "hello", "hey", "cool", "nice", "great", "thanks", "wait", "sorry",
  "alright", "anyway", "so", "well", "like", "test", "testing",
]);

/**
 * Catches input that plainly isn't an answer, before spending a model call on
 * it. An always-on mic transcribes coughs, keyboard noise and half-words, and
 * feeding those to the interviewer produces a reply to nothing. Semantic
 * randomness (a fluent but off-topic sentence) is left to the model, which is
 * instructed to deflect the same way.
 */
function looksRandom(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  if (trimmed.length < 3) return true;

  const words = trimmed.split(/[^a-z0-9'+\-*/=_<>[\]().]+/).filter(Boolean);
  if (words.length === 0) return true;
  if (words.length <= 3 && words.every((word) => FILLER_WORDS.has(word))) return true;

  // Room noise tends to transcribe as one long vowel-less run of letters.
  const [only] = words;
  if (words.length === 1 && only!.length > 10 && !/[aeiouy]/.test(only!)) return true;

  return false;
}

/** What the candidate did in the editor, when it wasn't them talking. */
type InterviewEvent = "run" | "code-review";

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
  testResult: ExecutionResult | null
) {
  return `You are Alex, a friendly but rigorous AI technical interviewer conducting a live coding interview.

Problem: ${problem.title} (${problem.difficulty})
${problem.description}

The candidate's editor contains exactly this, right now:
\`\`\`python
${code.trim() || "(the editor is still empty)"}
\`\`\`
${testResult ? `\nMost recent run of that code:\n${describeTestResult(testResult)}\n` : ""}
Guidelines:
- Keep replies short and conversational (2-4 sentences), like a real spoken interview.
- You can see the editor. Ground your feedback in what is actually written there:
  name the variable, function, loop or missing branch you mean, and comment on
  changes they've made since your last message. Never claim you cannot see their code.
- If the code is empty or unchanged, ask about their approach instead of inventing detail.
- Point out real bugs, missing edge cases and complexity problems in their code, but
  nudge — ask a question that leads them to it rather than handing over the fix.
- Ask the candidate to explain their approach before or while they code.
- Do not repeat the full problem statement back to them.
- If the candidate's latest message is unintelligible, filler, or unrelated to the
  interview, reply with exactly this and nothing else: "${DEFLECT_REPLY}"`;
}

/** The turn that stands in for the candidate when the editor is what changed. */
function eventPrompt(event: InterviewEvent, testResult: ExecutionResult | null): string {
  if (event === "run") {
    return `[The candidate just ran their code against the test cases.
${testResult ? describeTestResult(testResult) : "No results came back."}
React to this specific result. If cases fail, point at the case and the part of
their code responsible without writing the fix for them. If everything passes,
acknowledge it briefly and probe complexity or an edge case the tests miss.]`;
  }

  return `[The candidate has been writing code without saying anything. Look at the
editor contents above and give one short, specific observation or question about
what they have written so far — reference the actual code. If it looks correct,
ask about an edge case or the complexity. Don't repeat feedback you've already given.]`;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { problemId, history, code, testResult, event } = body as {
    problemId?: string;
    history?: ChatTurn[];
    code?: string;
    testResult?: ExecutionResult | null;
    event?: InterviewEvent;
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
    ? [...turns, { role: "user", text: eventPrompt(event, testResult ?? null) }]
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
      buildSystemInstruction(problem, code ?? "", testResult ?? null),
      contents
    );
    if (reply) {
      return NextResponse.json({ reply, mocked: false });
    }
  } catch (err) {
    console.error("Gemini interview call failed, falling back to mock:", err);
    // A quota bounce is the common case, and it looks exactly like the
    // interviewer ignoring the candidate's code, so report which it was.
    quotaHit = isQuotaError(err);
  }

  // An editor event has no scripted equivalent — staying quiet beats a canned
  // line about code the script never saw.
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
