import type { Language } from "./languages";

export type TestCase = {
  args: unknown[];
  expected: unknown;
};

/**
 * The shape of a function's inputs and output. Python and JavaScript ignore
 * this, but the statically typed runners need it to declare each test case's
 * arguments and to print the return value back as JSON.
 */
export type ValueType = "int" | "bool" | "string" | "int[]" | "int[][]";

export type Problem = {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string;
  description: string;
  examples: { input: string; output: string; explanation?: string }[];
  constraints: string[];
  funcName: string;
  /**
   * Every problem offers all six languages: paramTypes/returnType (both
   * always given together) tell the four statically typed runners how to
   * declare each test case's arguments and print the return value back out.
   */
  starterCode: Partial<Record<Language, string>>;
  paramTypes?: ValueType[];
  returnType?: ValueType;
  testCases: TestCase[];
};

/**
 * The argument names as the candidate sees them, read off the Python starter's
 * signature since every problem has one (`def two_sum(nums, target):`).
 */
export function paramNames(problem: Problem): string[] {
  const match = /def\s+\w+\s*\(([^)]*)\)/.exec(problem.starterCode.python ?? "");
  const names = (match?.[1] ?? "")
    .split(",")
    .map((part) => part.trim().split(/[:=]/)[0]!.trim())
    .filter(Boolean);
  const count = problem.testCases[0]?.args.length ?? names.length;
  return Array.from({ length: count }, (_, i) => names[i] ?? `arg${i + 1}`);
}
