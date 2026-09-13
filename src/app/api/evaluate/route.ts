import { NextResponse } from "next/server";
import { DEFAULT_LANGUAGE, isLanguage, languageLabel } from "@/lib/languages";
import { getProblem } from "@/lib/problems-store";
import { runCode } from "@/lib/execute";
import { aiProviderLabel, DEFAULT_AI_PROVIDER, generateJson, isAiProvider } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth";
import { describeDatabaseError } from "@/lib/firestore";
import {
  getSession,
  matchesSubmission,
  saveCompletedSession,
  SessionConflictError,
} from "@/lib/interview-sessions";
import { gradedKeys, validatedEvaluation, type ChatTurn, type Evaluation } from "@/lib/interview-session-types";
import {
  computeOverall,
  correctnessFromTests,
  mentionsComplexity,
  rubricText,
  type DimensionScore,
  type DimensionScores,
} from "@/lib/grading";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_CHARS = 160_000;
const MAX_CODE_CHARS = 32_000;
const MAX_TRANSCRIPT_CHARS = 100_000;

/**
 * What the report says when the grader is unavailable: correctness is still
 * real because it comes from the test run, and everything else is marked
 * "not assessed" rather than dressed up as a score nobody actually gave.
 */
function buildFallbackEvaluation(correctness: DimensionScore, history: ChatTurn[]): Evaluation {
  const unavailable = { score: null, rationale: "Not assessed: the grader was unavailable for this session." };
  const scores = { correctness } as DimensionScores;
  for (const key of gradedKeys) scores[key] = unavailable;
  const passed = correctness.score ?? 0;
  const mentionedComplexity = history.some(
    (turn) => turn.role === "user" && mentionsComplexity(turn.text),
  );
  return {
    overall: computeOverall(scores),
    scores,
    feedback:
      passed === 10
        ? "All test cases passed. The grader was unavailable, so only correctness is scored — narrating your complexity analysis explicitly is worth practising regardless."
        : "Some test cases failed. The grader was unavailable, so only correctness is scored. Focus on edge cases (empty input, duplicates, boundaries) and re-check your logic against the examples.",
    strengths: passed > 0 ? [correctness.rationale] : [],
    weaknesses: [
      ...(passed < 10 ? ["Review the failing test cases."] : []),
      ...(mentionedComplexity ? [] : ["Explain the time and space complexity of your approach."]),
    ],
  };
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in. Log in and retry." }, { status: 401 });
  }
  const ownerId = user.uid;

  const bodyText = await request.text();
  if (bodyText.length > MAX_BODY_CHARS) {
    return NextResponse.json({ error: "Interview is too large to submit." }, { status: 413 });
  }
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(bodyText) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid object");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
  }
  const { id, problemId, code, history, startedAt, language, runs, provider } = body;
  if (
    typeof id !== "string" || !UUID_PATTERN.test(id) ||
    typeof problemId !== "string" ||
    typeof code !== "string" || code.length > MAX_CODE_CHARS || Buffer.byteLength(code, "utf8") > 60_000 ||
    !Array.isArray(history) || history.length > 200 ||
    !history.every((turn) =>
      turn && typeof turn === "object" &&
      (turn.role === "user" || turn.role === "model") &&
      typeof turn.text === "string" && turn.text.length <= 2000
    ) ||
    typeof startedAt !== "string" || !Number.isFinite(Date.parse(startedAt)) ||
    (runs !== undefined && (typeof runs !== "number" || !Number.isInteger(runs) || runs < 0 || runs > 10_000))
  ) {
    return NextResponse.json({ error: "Invalid interview submission." }, { status: 400 });
  }
  const aiProvider = isAiProvider(provider) ? provider : DEFAULT_AI_PROVIDER;
  const turns = history as ChatTurn[];
  if (turns.reduce((size, turn) => size + turn.text.length, 0) > MAX_TRANSCRIPT_CHARS) {
    return NextResponse.json({ error: "Transcript is too large to submit." }, { status: 413 });
  }

  const problem = await getProblem(problemId);
  if (!problem) {
    return NextResponse.json({ error: "Unknown problem." }, { status: 404 });
  }

  try {
    const existing = await getSession(id, ownerId);
    if (existing) {
      if (!matchesSubmission(existing, problemId, code, turns)) {
        return NextResponse.json({ error: "This report ID was already used for a different submission." }, { status: 409 });
      }
      return NextResponse.json({ id: existing.id });
    }
  } catch (error) {
    console.error("Firestore report lookup failed:", describeDatabaseError(error));
    return NextResponse.json({ error: "Report storage is unavailable. Check Firestore and retry." }, { status: 503 });
  }
  const lang = isLanguage(language) ? language : DEFAULT_LANGUAGE;
  const execResult = await runCode(lang, problem, code);
  const correctness = correctnessFromTests(execResult.passed, execResult.total, execResult.crashed);
  const fallback = buildFallbackEvaluation(correctness, turns);
  const runCount = typeof runs === "number" ? runs : null;

  const transcript = turns
    .map((t) => `${t.role === "user" ? "Candidate" : "Interviewer"}: ${t.text}`)
    .join("\n");

  const starter = problem.starterCode[lang] ?? "";
  const codeIsStarter = code.trim() === starter.trim();
  const runSummary = runCount === null
    ? "Unknown how many times the candidate ran the tests during the interview."
    : runCount === 0
      ? "The candidate never ran the tests during the interview."
      : `The candidate ran the tests ${runCount} time${runCount === 1 ? "" : "s"} during the interview.`;

  const systemInstruction = `You are grading a technical coding interview against a fixed rubric. Be strict and evidence-based: every score must be justified by something in the transcript or the code. Do not give credit for effort that isn't visible.

Problem: ${problem.title} - ${problem.description}

Final candidate code, written in ${languageLabel(lang)}${codeIsStarter ? " (UNCHANGED from the starter template)" : ""}:
\`\`\`${lang}
${code}
\`\`\`

Final test run: ${execResult.passed}/${execResult.total} passed.${execResult.crashed ? ` Code crashed: ${execResult.crashOutput}` : ""}
${runSummary}
Correctness has already been scored ${correctness.score ?? "n/a"}/10 from the test run; do not score it.

Interview transcript:
${transcript || "(no conversation recorded)"}

RUBRIC — score each dimension 0-10 as an integer, interpolating between these anchors:

${rubricText()}

Rules:
- A score of null means "not assessed" and is ONLY for the situations listed above. If the candidate had the opportunity and didn't take it, that is a low score, not null.
- Off-topic talk, profanity, or steering the conversation away from the problem lowers communication to 3 or below, however friendly the tone.
- Nervousness on its own is not penalised; what matters is whether the candidate engaged with the problem.
- Each "rationale" is one sentence citing concrete evidence (what they said, wrote, or ran). Do not restate the score.

Return ONLY a JSON object with this exact shape:
{"problemSolving": {"score": number|null, "rationale": string}, "codeQuality": {"score": number|null, "rationale": string}, "communication": {"score": number|null, "rationale": string}, "complexityAnalysis": {"score": number|null, "rationale": string}, "debugging": {"score": number|null, "rationale": string}, "feedback": string, "strengths": string[], "weaknesses": string[]}
"feedback" is 2-3 sentences of specific, constructive feedback that names the single most valuable thing to work on next. Give 1-3 evidence-based strengths and 1-3 specific improvement areas; use empty arrays when there is no evidence for a point.`;

  let evaluation = fallback;
  let mocked = true;
  try {
    const generated = await generateJson<unknown>(aiProvider, systemInstruction, [
      { role: "user", text: "Grade this interview now." },
    ]);
    const valid = validatedEvaluation(generated, correctness);
    if (valid) {
      evaluation = valid;
      mocked = false;
    }
  } catch (err) {
    console.error(`${aiProviderLabel(aiProvider)} evaluate call failed, falling back to mock:`, err);
  }

  const now = Date.now();
  const clientStart = Date.parse(startedAt);
  const safeStart = new Date(Math.min(now, Math.max(now - 7 * 24 * 60 * 60 * 1000, clientStart))).toISOString();
  try {
    await saveCompletedSession({
      id,
      ownerId,
      problemId,
      problemTitle: problem.title,
      transcript: turns,
      finalCode: code,
      evaluation,
      testsPassed: execResult.passed,
      testsTotal: execResult.total,
      mocked,
      startedAt: safeStart,
    });
    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof SessionConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Firestore report save failed:", describeDatabaseError(error));
    return NextResponse.json({ error: "Could not save the report. Check Firestore and retry this submission." }, { status: 503 });
  }
}
