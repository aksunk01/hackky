import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { Problem } from "../problems";

export const execFileAsync = promisify(execFile);

export type TestResult = {
  args: unknown[];
  expected: unknown;
  actual: unknown;
  passed: boolean;
  error?: string;
};

export type ExecutionResult = {
  results: TestResult[];
  passed: number;
  total: number;
  crashed: boolean;
  crashOutput?: string;
};

/**
 * One test case as the harness reports it. Every language prints the same
 * shape, so comparing against the expected value happens here once rather
 * than being reimplemented in six languages.
 */
export type RawResult = { actual: unknown; error: string | null };

export const COMPILE_TIMEOUT_MS = 15_000;
export const EXEC_OPTIONS = {
  timeout: 5000,
  maxBuffer: 1024 * 1024,
};

/** The JSON the harness prints, which is always its last line of output. */
export function parseRawResults(stdout: string): RawResult[] {
  const line = stdout.trim().split("\n").pop() ?? "[]";
  return JSON.parse(line) as RawResult[];
}

export function toExecutionResult(problem: Problem, raw: RawResult[]): ExecutionResult {
  const results: TestResult[] = problem.testCases.map((testCase, i) => {
    const reported = raw[i] ?? { actual: null, error: "no result reported" };
    return {
      args: testCase.args,
      expected: testCase.expected,
      actual: reported.actual,
      passed:
        reported.error == null &&
        JSON.stringify(reported.actual) === JSON.stringify(testCase.expected),
      ...(reported.error ? { error: reported.error } : {}),
    };
  });

  return {
    results,
    passed: results.filter((r) => r.passed).length,
    total: results.length,
    crashed: false,
  };
}

export function crashedResult(problem: Problem, message: string): ExecutionResult {
  return {
    results: [],
    passed: 0,
    total: problem.testCases.length,
    crashed: true,
    crashOutput: message.slice(0, 2000),
  };
}

/** Compiler and runtime diagnostics land on stderr; fall back to the error itself. */
export function errorText(err: unknown): string {
  if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
    const command = "path" in err ? String(err.path) : "the compiler";
    return `${command} is not installed on the machine running this interview, so this language can't be run here.`;
  }
  if (err && typeof err === "object" && "stderr" in err) {
    const stderr = String((err as { stderr?: string }).stderr ?? "").trim();
    if (stderr) return stderr;
  }
  if (err && typeof err === "object" && "stdout" in err) {
    const stdout = String((err as { stdout?: string }).stdout ?? "").trim();
    if (stdout) return stdout;
  }
  return String(err);
}

export async function withTempDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "interview-run-"));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
