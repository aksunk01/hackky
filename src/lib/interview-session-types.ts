export type ChatTurn = { role: "user" | "model"; text: string };

export type Evaluation = {
  overall: number;
  problemSolving: number;
  communication: number;
  correctness: number;
  codeQuality: number;
  complexityAnalysis: number;
  debugging: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
};

export type SessionSummary = {
  id: string;
  problemTitle: string;
  overallScore: number;
  testsPassed: number;
  testsTotal: number;
  completedAt: string;
};

export type InterviewSession = SessionSummary & {
  problemId: string;
  transcript: ChatTurn[];
  finalCode: string;
  evaluation: Evaluation;
  mocked: boolean;
  startedAt: string;
};

const scoreKeys = [
  "problemSolving",
  "communication",
  "correctness",
  "codeQuality",
  "complexityAnalysis",
  "debugging",
] as const;

export const metrics: { key: (typeof scoreKeys)[number]; label: string }[] = [
  { key: "problemSolving", label: "Problem Solving" },
  { key: "communication", label: "Communication" },
  { key: "correctness", label: "Correctness" },
  { key: "codeQuality", label: "Code Quality" },
  { key: "complexityAnalysis", label: "Complexity Analysis" },
  { key: "debugging", label: "Debugging" },
];

export function validatedEvaluation(value: unknown): Evaluation | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const validScore = (score: unknown, max: number) =>
    typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= max;
  const validPoints = (points: unknown) =>
    Array.isArray(points) &&
    points.length <= 8 &&
    points.every((point) => typeof point === "string" && point.trim().length > 0 && point.length <= 500);

  const valid = (
    validScore(item.overall, 100) &&
    scoreKeys.every((key) => validScore(item[key], 10)) &&
    typeof item.feedback === "string" &&
    item.feedback.trim().length > 0 &&
    item.feedback.length <= 4000 &&
    validPoints(item.strengths) &&
    validPoints(item.weaknesses)
  );
  if (!valid) return null;
  return {
    overall: Math.round(item.overall as number),
    problemSolving: Math.round(item.problemSolving as number),
    communication: Math.round(item.communication as number),
    correctness: Math.round(item.correctness as number),
    codeQuality: Math.round(item.codeQuality as number),
    complexityAnalysis: Math.round(item.complexityAnalysis as number),
    debugging: Math.round(item.debugging as number),
    feedback: (item.feedback as string).trim(),
    strengths: (item.strengths as string[]).map((point) => point.trim()),
    weaknesses: (item.weaknesses as string[]).map((point) => point.trim()),
  };
}
