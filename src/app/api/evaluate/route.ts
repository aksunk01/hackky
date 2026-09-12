import { NextResponse } from "next/server";
import { getProblem } from "@/lib/problems";
import { runPython } from "@/lib/execute";
import { generateJson } from "@/lib/gemini";
import { getOwnerId } from "@/lib/owner-cookie";
import { describeDatabaseError } from "@/lib/mysql";
import {
  getSession,
  matchesSubmission,
  saveCompletedSession,
  SessionConflictError,
} from "@/lib/interview-sessions";
import { validatedEvaluation, type ChatTurn, type Evaluation } from "@/lib/interview-session-types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_CHARS = 160_000;
const MAX_CODE_CHARS = 32_000;
const MAX_TRANSCRIPT_CHARS = 100_000;

function clamp10(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(10, Math.round(n)));
}

function buildFallbackEvaluation(passed: number, total: number, history: ChatTurn[]): Evaluation {
  const correctness = total > 0 ? clamp10((passed / total) * 10) : 0;
  const base = total > 0 ? Math.round((passed / total) * 7) + 1 : 4;
  const overall = Math.round(
    ((correctness + base * 4) / 5) * 10
  ) / 10;
  return {
    overall: Math.round(overall * 10),
    problemSolving: clamp10(base),
    communication: clamp10(base),
    correctness,
    codeQuality: clamp10(base - (passed < total ? 1 : 0)),
    complexityAnalysis: clamp10(base - 1),
    debugging: clamp10(base),
    feedback:
      passed === total
        ? "Solid work — all test cases passed. Consider narrating your complexity analysis more explicitly next time."
        : "Some test cases failed. Focus on edge cases (empty input, duplicates, boundaries) and re-check your logic against the examples.",
    strengths: passed > 0 ? [`Passed ${passed} of ${total} test cases.`] : [],
    weaknesses: [
      ...(passed < total ? [`Review the ${total - passed} failing test case${total - passed === 1 ? "" : "s"}.`] : []),
      ...(history.some((turn) => turn.role === "user" && /time complexity|space complexity|big[\s-]?o|\bo\(/i.test(turn.text))
        ? []
        : ["Explain the time and space complexity of your approach."]),
    ],
  };
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const ownerId = await getOwnerId();
  if (!ownerId) {
    return NextResponse.json({ error: "Interview owner was not initialized. Refresh and retry." }, { status: 401 });
  }

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
  const { id, problemId, code, history, startedAt } = body;
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
    typeof startedAt !== "string" || !Number.isFinite(Date.parse(startedAt))
  ) {
    return NextResponse.json({ error: "Invalid interview submission." }, { status: 400 });
  }
  const turns = history as ChatTurn[];
  if (turns.reduce((size, turn) => size + turn.text.length, 0) > MAX_TRANSCRIPT_CHARS) {
    return NextResponse.json({ error: "Transcript is too large to submit." }, { status: 413 });
  }

  const problem = getProblem(problemId);
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
    console.error("MySQL report lookup failed:", describeDatabaseError(error));
    return NextResponse.json({ error: "Report storage is unavailable. Check MySQL and retry." }, { status: 503 });
  }

  const execResult = await runPython(problem, code);
  const fallback = buildFallbackEvaluation(execResult.passed, execResult.total, turns);

  const transcript = turns
    .map((t) => `${t.role === "user" ? "Candidate" : "Interviewer"}: ${t.text}`)
    .join("\n");

  const systemInstruction = `You are grading a technical coding interview. Problem: ${problem.title} - ${problem.description}

Final candidate code:
\`\`\`python
${code}
\`\`\`

Test results: ${execResult.passed}/${execResult.total} passed.
${execResult.crashed ? `Code crashed: ${execResult.crashOutput}` : ""}

Interview transcript:
${transcript || "(no conversation recorded)"}

Return ONLY a JSON object with this exact shape, all numeric scores 0-10 except overall which is 0-100:
{"overall": number, "problemSolving": number, "communication": number, "correctness": number, "codeQuality": number, "complexityAnalysis": number, "debugging": number, "feedback": string, "strengths": string[], "weaknesses": string[]}
Base "correctness" primarily on the test results above. "feedback" should be 2-3 sentences of specific, constructive feedback. Give 1-3 evidence-based strengths and 1-3 specific improvement areas; use empty arrays when there is no evidence for a point.`;

  let evaluation = fallback;
  let mocked = true;
  try {
    const generated = await generateJson<unknown>(systemInstruction, [
      { role: "user", text: "Grade this interview now." },
    ]);
    const valid = validatedEvaluation(generated);
    if (valid) {
      evaluation = valid;
      mocked = false;
    }
  } catch (err) {
    console.error("Gemini evaluate call failed, falling back to mock:", err);
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
    console.error("MySQL report save failed:", describeDatabaseError(error));
    return NextResponse.json({ error: "Could not save the report. Check MySQL and retry this submission." }, { status: 503 });
  }
}
