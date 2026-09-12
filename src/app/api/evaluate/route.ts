import { NextResponse } from "next/server";
import { getProblem } from "@/lib/problems";
import { runPython } from "@/lib/execute";
import { generateJson, type ChatTurn } from "@/lib/gemini";

export type Evaluation = {
  overall: number;
  problemSolving: number;
  communication: number;
  correctness: number;
  codeQuality: number;
  complexityAnalysis: number;
  debugging: number;
  feedback: string;
};

function clamp10(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(10, Math.round(n)));
}

function buildFallbackEvaluation(passed: number, total: number): Evaluation {
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
  };
}

export async function POST(request: Request) {
  const body = await request.json();
  const { problemId, history, code } = body as {
    problemId?: string;
    history?: ChatTurn[];
    code?: string;
  };

  if (!problemId || typeof code !== "string") {
    return NextResponse.json(
      { error: "problemId and code are required." },
      { status: 400 }
    );
  }

  const problem = getProblem(problemId);
  if (!problem) {
    return NextResponse.json({ error: "Unknown problem." }, { status: 404 });
  }

  const execResult = await runPython(problem, code);
  const fallback = buildFallbackEvaluation(execResult.passed, execResult.total);

  const transcript = (history ?? [])
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
{"overall": number, "problemSolving": number, "communication": number, "correctness": number, "codeQuality": number, "complexityAnalysis": number, "debugging": number, "feedback": string}
Base "correctness" primarily on the test results above. "feedback" should be 2-3 sentences of specific, constructive feedback.`;

  try {
    const evaluation = await generateJson<Evaluation>(systemInstruction, [
      { role: "user", text: "Grade this interview now." },
    ]);
    if (evaluation) {
      return NextResponse.json({
        evaluation,
        execResult,
        mocked: false,
      });
    }
  } catch (err) {
    console.error("Gemini evaluate call failed, falling back to mock:", err);
  }

  return NextResponse.json({
    evaluation: fallback,
    execResult,
    mocked: true,
  });
}
