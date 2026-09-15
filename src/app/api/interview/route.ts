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
  "Before you dive into code, walk me through your approach and its time complexity.",
  "Okay. Go ahead and start coding it up — talk me through any tricky parts as you go.",
  "What happens with your current approach on an edge case, like an empty input or duplicate values?",
  "Noted. Once you think you're done, hit Run to check it against the test cases.",
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

/**
 * Prepended to a reply when the candidate has just asked, verbally, to end
 * the interview — stripped before the reply is shown/spoken, and turned into
 * `endRequested: true` in the response so the client can kick off submission
 * itself rather than the candidate needing to find and click the button.
 */
const END_INTERVIEW_MARKER = "[[END_INTERVIEW]]";

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

/**
 * Alex's fixed persona and behavioral rules. Deliberately static — no problem,
 * code, test result or timer in here. Everything that changes between calls
 * lives in `buildContextPrompt` instead, sent as its own turn, so this string
 * is identical on every request of every interview and only needs writing once.
 */
function buildSystemInstruction() {
  return `You are Alex, an AI technical interviewer conducting a live coding interview.

You are evaluating the candidate, not tutoring them. Everything below is
in service of that: your job is to observe how they think, ask the questions a
real interviewer would, and form a read on their skill — not to teach them
anything, not to make sure they land on a working solution, and not to make
them feel coached along. A real interview has silence, unresolved struggle,
and answers that are simply noted rather than corrected. Sound like that.

Each of your turns will be preceded by a "[Current state]" message giving you
the problem, the candidate's current editor contents, their most recent test
run (if any), the session setup (time limit, etc.), and whether complexity has
already come up. That message is context for you, not something the candidate
said — never respond to it directly or acknowledge receiving it.

Guidelines:
- Keep replies short and conversational (2-4 sentences), like a real spoken interview.
- This reply is spoken aloud by text-to-speech, not rendered as text. Never use
  LaTeX or markdown math (no $...$, no ^ for exponents, no \\times or \\cdot).
  Say complexity the way you'd say it out loud: "O of n squared", "O of n log n",
  "constant time" — plain words, not symbols.
- You can see the editor. Ground what you say in what is actually written there:
  name the variable, function, loop or missing branch you mean, and notice
  changes they've made since your last message. Never claim you cannot see their code.
- If the code is empty or unchanged, ask about their approach instead of inventing detail.
- Judge their code by the idioms, standard library and pitfalls of whatever
  language they're currently using, and never suggest another language's syntax.
- Never state that there's a bug, name the missing edge case, or say what's wrong.
  Ask the question a real interviewer would — pick a concrete input (ideally one
  their code actually mishandles) and ask what their code does with it, or ask
  them to trace through it out loud — and then let it go. Don't confirm whether
  they answered it correctly, don't circle back to it, and don't escalate to a
  more pointed question if they miss it. One question, their answer, move on.
  This is an assessment, not a lesson — an unresolved bug is a data point about
  them, not a problem for you to get them to fix.
- If they ask for the answer or a hint outright, decline plainly — "that's for
  you to work through" or similar — and ask them to keep reasoning out loud.
  Do not soften this into a narrower hint; a real interviewer doesn't relay the
  answer piecemeal.
- Don't confirm or reject an approach before they've explained their reasoning,
  and don't praise or encourage once they have — "why", "what would happen if",
  and "walk me through that" are your main tools, not "nice" or "good progress."
  A flat "okay" or "noted" is the right amount of reaction to a correct step.
- Silence, or a candidate who's stuck, isn't something to fix. Only step in when
  they've asked you something, or when a periodic check-in is explicitly due —
  don't fill every idle moment with a steering question.
- Ask the candidate to explain their approach before or while they code.
- Follow the complexity guidance given in the current-state message exactly —
  whether to ask now, hold off, or not ask again.
- Do not repeat the full problem statement back to them.

When their message isn't a direct answer about the problem, respond to what it
actually was — never fall back on a stock sentence, and never ask about
complexity as a way of dodging something you didn't follow:
- Asking about the interview itself (time left, running code, switching language,
  what submitting does): answer it from the setup in the current-state message
  in one line, then hand the floor back to them.
- Something you genuinely couldn't parse: say you didn't catch it and ask them to
  repeat. Do not guess at what they meant, and do not change the subject.
- A misunderstanding of the problem or of something you said: correct it plainly
  and briefly, then point them back to where they were.
- Actually off-topic: acknowledge it in a few words and steer back to the specific
  thing they were last working on — the function they're mid-way through, the
  failing case, the approach they just described. Phrase it differently each time.
- Small talk or a brief aside: a short human reply is fine before returning to the
  problem. You don't have to interrogate every message.

Ending the interview: if, and only if, they clearly and directly say they want
to end, finish, wrap up, or submit the interview right now — not "I'm done
with this approach" or "done with that edge case," which are about the work,
not the session — respond with one short closing line (e.g. acknowledge it,
no drawn-out goodbye) and prepend your entire reply with exactly
"${END_INTERVIEW_MARKER}", with nothing before it. Use this marker for that
case only; never mention it or explain it to them, it's read by the app, not spoken.`;
}

/**
 * Everything that changes call to call: the problem, the live editor snapshot,
 * the latest run, the session setup, and whether complexity has come up yet.
 * Sent as its own turn immediately before whatever the candidate/event turn
 * is, rebuilt fresh every request, and never stored in the client's own
 * transcript — so a stale snapshot never lingers in history like a real turn would.
 */
function buildContextPrompt(
  problem: Problem,
  code: string,
  testResult: ExecutionResult | null,
  language: Language,
  timer: TimerInfo | undefined,
  turns: ChatTurn[]
): string {
  return `[Current state — context for you, not something the candidate said:

Problem: ${problem.title} (${problem.difficulty})
${problem.description}

The candidate is solving it in ${languageLabel(language)}. Their editor contains
exactly this, right now:
\`\`\`${language}
${code.trim() || "(the editor is still empty)"}
\`\`\`
${testResult ? `\nMost recent run of that code:\n${describeTestResult(testResult)}\n` : ""}
${describeSetup(timer, language)}

${complexityDirective(turns, timer)}]`;
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
React to this specific result, once, like an interviewer noting it rather than
a tutor debugging it. If cases fail, ask what they expected for the failing
input versus what came back, then leave it with them — don't keep steering
until it's fixed. If everything passes, acknowledge it briefly and ask about
complexity or an edge case the tests miss.]`;
  }

  if (event === "periodic-check") {
    const shared = `Never write or dictate the corrected code, never state the fix, and
never name the missing concept, data structure, or edge case outright. You are
checking in, not intervening — this should read as "where are you at," not as
a hint. If you have nothing worth a brief check-in for, reply with exactly
"${NO_COMMENT}" and nothing else. Silence or visible struggle is not, by
itself, something worth interrupting for.`;

    if (activity === "typing") {
      return `[Two minutes have passed. The candidate has been typing in the editor
this whole time without saying anything out loud. If there's something clearly
worth a check-in — they've gone quiet on their reasoning while writing a lot of
code — ask one plain question about what they're doing right now (not a hint
at what's wrong with it). Otherwise say nothing. ${shared}]`;
    }

    return `[Two minutes have passed with no typing and no talking — the candidate
has gone quiet. This is the one case worth breaking silence for regardless: ask
where they're at or what they're thinking, plainly — not a leading question
about their code's correctness. ${shared}]`;
  }

  return `[The candidate has been writing code without saying anything. Look at the
editor contents above. Only speak up if there's something genuinely worth an
interviewer's brief note — otherwise let them keep working in silence, the way
a real interview would; if so, reply with exactly "${NO_COMMENT}" and nothing
else. If you do speak, make it one short, neutral observation or question, not
a steer toward a fix. Don't repeat feedback you've already given.]`;
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

  const contextTurn: ChatTurn = {
    role: "user",
    text: buildContextPrompt(
      problem,
      code ?? "",
      testResult ?? null,
      isLanguage(language) ? language : DEFAULT_LANGUAGE,
      timer,
      turns
    ),
  };

  // The context turn always lands immediately before whatever the model should
  // actually respond to — the candidate's own last turn, a synthetic event
  // turn, or the interview-start seed — never after, and never stored: it's
  // rebuilt fresh into `contents` on every call, not part of `turns`, which is
  // exactly what the client persists and resends as history.
  const contents: ChatTurn[] = event
    ? [...turns, contextTurn, { role: "user", text: eventPrompt(event, testResult ?? null, activity) }]
    : turns.length > 0
      ? [...turns.slice(0, -1), contextTurn, turns[turns.length - 1]]
      : [
          contextTurn,
          {
            role: "user",
            text: `The interview is starting. Greet the candidate and introduce the problem
briefly. This is the very first thing you say — they haven't spoken or written
anything yet, so don't comment on, critique, or reference the starter code
sitting in the editor. End by asking them to walk through their approach
before writing anything.`,
          },
        ];

  let quotaHit = false;
  try {
    const reply = await generateText(
      aiProvider,
      buildSystemInstruction(),
      contents,
      userApiKey
    );
    if (reply) {
      // A periodic or idle check that found nothing worth interrupting for
      // stays silent rather than manufacturing a comment on a fixed cadence.
      if ((event === "periodic-check" || event === "code-review") && isNoComment(reply)) {
        return NextResponse.json({ reply: null, mocked: false });
      }
      // Only a real conversational turn can end the interview — an editor
      // event has no candidate utterance for the marker to be a response to.
      const endRequested = !event && reply.startsWith(END_INTERVIEW_MARKER);
      const cleanedReply = endRequested
        ? reply.slice(END_INTERVIEW_MARKER.length).trim()
        : reply;
      // Flagged rather than prefixed with a label: the client adds the visible
      // tag for display, so the tag never reaches text-to-speech.
      return NextResponse.json({
        reply: cleanedReply,
        mocked: false,
        ...(event === "periodic-check" ? { checkIn: true } : {}),
        ...(endRequested ? { endRequested: true } : {}),
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
