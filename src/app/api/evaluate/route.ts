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

const COMPLEXITY_TALK = /\bo\([^)]*\)|time complexity|space complexity|big[\s-]?o\b/i;

function buildFallbackEvaluation(
  passed: number,
  total: number,
  history: ChatTurn[]
): Evaluation {
  const userTurns = history.filter((t) => t.role === "user");
  const userChars = userTurns.reduce((sum, t) => sum + t.text.trim().length, 0);
  const discussedComplexity = userTurns.some((t) => COMPLEXITY_TALK.test(t.text));

  const correctness = total > 0 ? clamp10((passed / total) * 10) : 0;
  const codingBase = total > 0 ? Math.round((passed / total) * 7) + 1 : 4;

  // Engagement is a rough proxy for communication: near-silence caps the score low,
  // regardless of how well the code itself scores, rather than mirroring codingBase.
  const communication = clamp10(
    Math.min(9, 1 + userTurns.length * 1.5 + Math.min(userChars / 80, 3))
  );
  const problemSolving = clamp10(codingBase - (userTurns.length === 0 ? 2 : 0));
  const complexityAnalysis = clamp10(discussedComplexity ? codingBase : 3);
  const codeQuality = clamp10(codingBase - (passed < total ? 1 : 0));
  const debugging = clamp10(codingBase);

  const overall = Math.round(
    (correctness + problemSolving + communication + codeQuality + complexityAnalysis + debugging) *
      (100 / 60)
  );

  const feedbackParts: string[] = [
    passed === total
      ? "All test cases passed."
      : `${passed}/${total} test cases passed — check edge cases and re-verify your logic.`,
  ];
  if (userTurns.length === 0) {
    feedbackParts.push(
      "You didn't discuss your approach with the interviewer at all — talking through your reasoning out loud is a big part of a real interview and this scores it low."
    );
  } else if (!discussedComplexity) {
    feedbackParts.push("Consider explicitly stating time/space complexity next time.");
  }

  return {
    overall,
    problemSolving,
    communication,
    correctness,
    codeQuality,
    complexityAnalysis,
    debugging,
    feedback: feedbackParts.join(" "),
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
  const fallback = buildFallbackEvaluation(execResult.passed, execResult.total, history ?? []);

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
