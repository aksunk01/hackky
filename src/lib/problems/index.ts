import type { Difficulty, Problem } from "@/lib/types";
import { EASY_PROBLEMS } from "./easy";
import { MEDIUM_PROBLEMS } from "./medium";
import { HARD_PROBLEMS } from "./hard";

export const PROBLEMS: Problem[] = [
  ...EASY_PROBLEMS,
  ...MEDIUM_PROBLEMS,
  ...HARD_PROBLEMS,
];

const BY_ID = new Map(PROBLEMS.map((p) => [p.id, p]));

export function getProblem(id: string): Problem | undefined {
  return BY_ID.get(id);
}

export function problemsByDifficulty(difficulty: Difficulty): Problem[] {
  return PROBLEMS.filter((p) => p.difficulty === difficulty);
}

/** Everything the config screen needs, without shipping tests or hint ladders. */
export function problemSummaries() {
  return PROBLEMS.map((p) => ({
    id: p.id,
    title: p.title,
    difficulty: p.difficulty,
    category: p.category,
    blurb: p.description[0],
    visibleTests: p.tests.filter((t) => !t.hidden).length,
    hiddenTests: p.tests.filter((t) => t.hidden).length,
  }));
}

/** The candidate must never receive hidden test data or the hint ladder. */
export function publicProblem(p: Problem) {
  return {
    id: p.id,
    title: p.title,
    difficulty: p.difficulty,
    category: p.category,
    description: p.description,
    examples: p.examples,
    constraints: p.constraints,
    functionName: p.functionName,
    paramNames: p.paramNames,
    starter: p.starter,
    visibleTests: p.tests
      .map((t, i) => ({ ...t, index: i }))
      .filter((t) => !t.hidden)
      .map((t) => ({
        index: t.index,
        label: t.label ?? `test ${t.index + 1}`,
        args: t.args,
        expected: t.expected,
      })),
    hiddenTestCount: p.tests.filter((t) => t.hidden).length,
  };
}

export type PublicProblem = ReturnType<typeof publicProblem>;
