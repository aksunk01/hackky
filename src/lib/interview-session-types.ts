import {
  computeOverall,
  dimensionKeys,
  type DimensionKey,
  type DimensionScore,
  type DimensionScores,
} from "@/lib/grading";

export type ChatTurn = { role: "user" | "model"; text: string };

export type Evaluation = {
  /** 0–100, the weighted mean of the assessed dimensions (see grading.ts). */
  overall: number;
  scores: DimensionScores;
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

/** The dimensions the model scores; correctness is set from the test run. */
export const gradedKeys = dimensionKeys.filter((key) => key !== "correctness") as Exclude<DimensionKey, "correctness">[];

const MAX_RATIONALE_CHARS = 500;

function validDimensionScore(value: unknown): DimensionScore | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const score = item.score;
  const rationale = item.rationale;
  const scoreOk = score === null || (typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 10);
  const rationaleOk = typeof rationale === "string" && rationale.trim().length > 0 && rationale.length <= MAX_RATIONALE_CHARS;
  if (!scoreOk || !rationaleOk) return null;
  return {
    score: score === null ? null : Math.round(score as number),
    rationale: (rationale as string).trim(),
  };
}

function validPoints(points: unknown): points is string[] {
  return (
    Array.isArray(points) &&
    points.length <= 8 &&
    points.every((point) => typeof point === "string" && point.trim().length > 0 && point.length <= 500)
  );
}

/**
 * Checks the grader's JSON and folds in the test-derived correctness score.
 * The overall is recomputed here rather than trusted, so it always matches
 * the dimension scores shown beneath it.
 */
export function validatedEvaluation(value: unknown, correctness: DimensionScore): Evaluation | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;

  const scores = { correctness } as DimensionScores;
  for (const key of gradedKeys) {
    const score = validDimensionScore(item[key]);
    if (!score) return null;
    scores[key] = score;
  }
  if (
    typeof item.feedback !== "string" ||
    item.feedback.trim().length === 0 ||
    item.feedback.length > 4000 ||
    !validPoints(item.strengths) ||
    !validPoints(item.weaknesses)
  ) {
    return null;
  }
  return {
    overall: computeOverall(scores),
    scores,
    feedback: item.feedback.trim(),
    strengths: item.strengths.map((point) => point.trim()),
    weaknesses: item.weaknesses.map((point) => point.trim()),
  };
}

/**
 * Reports saved before the rubric existed stored one flat number per
 * dimension and an overall the model made up. They're shown as-is (with no
 * rationale line) rather than re-graded, so old history doesn't shift.
 */
export function normalizeEvaluation(raw: unknown): Evaluation {
  const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (item.scores && typeof item.scores === "object") return item as unknown as Evaluation;

  const scores = {} as DimensionScores;
  for (const key of dimensionKeys) {
    const legacy = item[key];
    scores[key] = {
      score: typeof legacy === "number" && Number.isFinite(legacy) ? Math.max(0, Math.min(10, Math.round(legacy))) : null,
      rationale: "",
    };
  }
  return {
    overall: typeof item.overall === "number" ? item.overall : computeOverall(scores),
    scores,
    feedback: typeof item.feedback === "string" ? item.feedback : "",
    strengths: validPoints(item.strengths) ? item.strengths : [],
    weaknesses: validPoints(item.weaknesses) ? item.weaknesses : [],
  };
}
