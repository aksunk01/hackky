/**
 * The grading rubric, shared by the grader prompt and the report page so a
 * score always means the same thing in both places. Every dimension carries
 * a weight (they sum to 100), and the overall score is the weighted mean of
 * the dimensions that were actually assessed — never a number the model
 * picks on its own.
 */

export const dimensionKeys = [
  "correctness",
  "problemSolving",
  "codeQuality",
  "communication",
  "complexityAnalysis",
  "debugging",
] as const;

export type DimensionKey = (typeof dimensionKeys)[number];

export type Dimension = {
  key: DimensionKey;
  label: string;
  /** Share of the overall score, out of 100. */
  weight: number;
  /** One line on what is being measured. */
  summary: string;
  /** What a score of 0, 5 and 10 look like — the grader is told to interpolate. */
  anchors: { 0: string; 5: string; 10: string };
  /** When the grader may leave this unscored instead of giving a 0. */
  notAssessedWhen?: string;
};

export const dimensions: Dimension[] = [
  {
    key: "correctness",
    label: "Correctness",
    weight: 30,
    summary: "Does the final code produce the right answer? Set directly from the test run, not by the grader.",
    anchors: {
      0: "No tests pass, or the code crashes.",
      5: "About half the tests pass — the core idea works but edge cases fail.",
      10: "Every test passes.",
    },
  },
  {
    key: "problemSolving",
    label: "Problem Solving",
    weight: 25,
    summary: "The path to a solution: understanding the problem, choosing an approach, and moving it forward.",
    anchors: {
      0: "Never engaged with the problem, or wrote nothing beyond the starter code.",
      5: "Reached a working brute-force idea, or a better idea that was never finished.",
      10: "Clarified the problem, weighed approaches, and drove to an efficient solution with little prompting.",
    },
  },
  {
    key: "codeQuality",
    label: "Code Quality",
    weight: 15,
    summary: "Readability and structure of the code that was written: naming, clarity, no dead code.",
    anchors: {
      0: "Unreadable or misleading code: cryptic names, leftover debug output, tangled control flow.",
      5: "Works but is harder to follow than it needs to be.",
      10: "Clear names, tidy structure, and nothing that would draw a comment in code review.",
    },
    notAssessedWhen: "no meaningful code was written beyond the starter template.",
  },
  {
    key: "communication",
    label: "Communication",
    weight: 15,
    summary: "Explaining your thinking, answering the interviewer's questions, and staying on task.",
    anchors: {
      0: "Silent, off-topic, or derailed the interview (unrelated chatter, profanity, ignoring questions).",
      5: "Answered direct questions but rarely narrated the approach unprompted.",
      10: "Thought aloud throughout, answered questions directly, and asked good clarifying questions.",
    },
  },
  {
    key: "complexityAnalysis",
    label: "Complexity Analysis",
    weight: 10,
    summary: "Stating the time and space complexity of the approach, and recognising a better one.",
    anchors: {
      0: "Never mentioned complexity, even when asked.",
      5: "Gave a complexity that was partly wrong or only for one of time/space.",
      10: "Correct time and space complexity, and explained the trade-off against alternatives.",
    },
  },
  {
    key: "debugging",
    label: "Debugging",
    weight: 5,
    summary: "How failing tests or crashes were diagnosed and fixed.",
    anchors: {
      0: "Tests failed or the code crashed and the candidate did not investigate.",
      5: "Fixed the failure by trial and error rather than by reasoning about the cause.",
      10: "Read the failing case, explained the cause, and fixed it deliberately.",
    },
    notAssessedWhen: "the code was never run, or it passed on the first run so there was nothing to debug.",
  },
];

/** Overall-score bands, worded the way real interview loops record a verdict. */
export const bands = [
  { min: 85, label: "Strong Hire", tone: "success" },
  { min: 70, label: "Hire", tone: "success" },
  { min: 55, label: "Lean Hire", tone: "warning" },
  { min: 35, label: "No Hire", tone: "warning" },
  { min: 0, label: "Strong No Hire", tone: "danger" },
] as const;

export type Band = (typeof bands)[number];

export function bandFor(overall: number): Band {
  return bands.find((band) => overall >= band.min) ?? bands[bands.length - 1];
}

export type DimensionScore = {
  /** 0–10, or null when the dimension could not be assessed. */
  score: number | null;
  /** One sentence of evidence for the score. */
  rationale: string;
};

export type DimensionScores = Record<DimensionKey, DimensionScore>;

/**
 * Weighted mean of the assessed dimensions, scaled to 0–100. Unassessed
 * dimensions drop out and their weight is redistributed, so a candidate
 * who never needed to debug isn't punished for it.
 */
export function computeOverall(scores: DimensionScores): number {
  let weighted = 0;
  let weightUsed = 0;
  for (const dimension of dimensions) {
    const { score } = scores[dimension.key];
    if (score === null) continue;
    weighted += score * dimension.weight;
    weightUsed += dimension.weight;
  }
  if (weightUsed === 0) return 0;
  return Math.round((weighted / weightUsed) * 10);
}

/**
 * Correctness comes straight from the test harness so it can't drift from
 * what the candidate actually saw. A crash is a 0 regardless of partial
 * output; no tests at all means it can't be assessed.
 */
export function correctnessFromTests(passed: number, total: number, crashed: boolean): DimensionScore {
  if (total === 0) return { score: null, rationale: "This problem has no automated tests." };
  if (crashed) return { score: 0, rationale: "The code crashed when run against the tests." };
  const score = Math.round((passed / total) * 10);
  return {
    score,
    rationale: passed === total
      ? `All ${total} tests passed.`
      : `${passed} of ${total} tests passed.`,
  };
}

/** The rubric as the grader sees it. */
export function rubricText(): string {
  return dimensions
    .filter((dimension) => dimension.key !== "correctness")
    .map((dimension) => {
      const lines = [
        `${dimension.key} — ${dimension.label} (${dimension.weight}% of overall): ${dimension.summary}`,
        `  0: ${dimension.anchors[0]}`,
        `  5: ${dimension.anchors[5]}`,
        `  10: ${dimension.anchors[10]}`,
      ];
      if (dimension.notAssessedWhen) {
        lines.push(`  Use null (not assessed) only when ${dimension.notAssessedWhen}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}
