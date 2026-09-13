import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { Problem, ValueType } from "../problems";

/** A problem with the type metadata the statically typed runners need. */
export type TypedProblem = Problem & { paramTypes: ValueType[]; returnType: ValueType };

export function requireTypes(problem: Problem): TypedProblem | null {
  return problem.paramTypes && problem.returnType ? (problem as TypedProblem) : null;
}

export const execFileAsync = promisify(execFile);

export type TestResult = {
  args: unknown[];
  expected: unknown;
  actual: unknown;
  passed: boolean;
  error?: string;
  /** What the candidate's code printed to stdout while this case ran. */
  stdout?: string;
};

export type ExecutionResult = {
  results: TestResult[];
  passed: number;
  total: number;
  crashed: boolean;
  crashOutput?: string;
  /** On a crash, everything the candidate printed before it (there are no per-case results). */
  stdout?: string;
  /** Whether a crash happened building the code or running it. */
  crashStage?: "compile" | "run";
  /** Wall time of the run itself, excluding compilation. */
  runtimeMs?: number;
};

/**
 * One test case as the harness reports it. Every language prints the same
 * shape, so comparing against the expected value happens here once rather
 * than being reimplemented in six languages.
 */
export type RawResult = { actual: unknown; error: string | null };

/**
 * Each harness prints this on its own line right before calling the candidate
 * for a case, so their stdout can be split back into per-case chunks.
 */
export const CASE_MARKER = "@@HACKKY_CASE@@";
const CASE_SPLIT = `\n${CASE_MARKER}\n`;

export const COMPILE_TIMEOUT_MS = 15_000;
export const EXEC_OPTIONS = {
  timeout: 5000,
  maxBuffer: 1024 * 1024,
};
export const COMPILE_OPTIONS = {
  timeout: COMPILE_TIMEOUT_MS,
  maxBuffer: EXEC_OPTIONS.maxBuffer,
};

const MAX_STDOUT_CHARS = 10_000;

/** Keeps the start of long output; the debug prints someone is looking for are usually there. */
function clampStdout(text: string): string | undefined {
  if (!text) return undefined;
  if (text.length <= MAX_STDOUT_CHARS) return text;
  return `${text.slice(0, MAX_STDOUT_CHARS)}\n… output truncated (${text.length - MAX_STDOUT_CHARS} more characters)`;
}

export type HarnessOutput = { raw: RawResult[]; printed: string };

/**
 * Every harness buffers its results and prints them as "\n" + JSON + "\n" once
 * the candidate's function has returned for every case, so the JSON is always
 * its own last line and everything before it is what the candidate printed.
 */
export function parseHarnessOutput(stdout: string): HarnessOutput {
  const trimmed = stdout.trimEnd();
  const cut = trimmed.lastIndexOf("\n");
  const line = cut === -1 ? trimmed : trimmed.slice(cut + 1);
  // The harness's own leading newline is the one at `cut`, so slicing to it
  // leaves the candidate's output exactly as they printed it.
  const printed = cut === -1 ? "" : stdout.slice(0, cut);
  return { raw: JSON.parse(line || "[]") as RawResult[], printed };
}

/**
 * Runs a built harness and turns what it printed into an ExecutionResult. A
 * crash (non-zero exit, signal, timeout) still reports whatever the candidate
 * managed to print, which is what you want when hunting an infinite loop.
 */
export async function runHarness(
  problem: Problem,
  command: string,
  args: string[],
  options: Parameters<typeof execFileAsync>[2] = EXEC_OPTIONS
): Promise<ExecutionResult> {
  const started = performance.now();
  try {
    const { stdout } = await execFileAsync(command, args, options);
    const runtimeMs = Math.round(performance.now() - started);
    return toExecutionResult(problem, parseHarnessOutput(String(stdout)), runtimeMs);
  } catch (err) {
    const stdout =
      err && typeof err === "object" && "stdout" in err
        ? String((err as { stdout?: string }).stdout ?? "")
        : "";
    // The markers printed so far say which case the crash happened in.
    const caseIndex = stdout.split(CASE_SPLIT).length - 1;
    const where = caseIndex > 0 ? ` (in case ${caseIndex})` : "";
    return crashedResult(problem, errorText(err) + where, stdout.split(CASE_SPLIT).join(""), "run");
  }
}

export function toExecutionResult(
  problem: Problem,
  output: HarnessOutput,
  runtimeMs?: number
): ExecutionResult {
  const { raw, printed } = output;
  // chunks[0] is anything printed before the first case (module-level code);
  // it's folded into case 1 rather than shown separately.
  const [preamble = "", ...chunks] = printed.split(CASE_SPLIT);
  const results: TestResult[] = problem.testCases.map((testCase, i) => {
    const reported = raw[i] ?? { actual: null, error: "no result reported" };
    const stdout = clampStdout((i === 0 ? preamble : "") + (chunks[i] ?? ""));
    return {
      args: testCase.args,
      expected: testCase.expected,
      actual: reported.actual,
      passed:
        reported.error == null &&
        JSON.stringify(reported.actual) === JSON.stringify(testCase.expected),
      ...(reported.error ? { error: reported.error } : {}),
      ...(stdout ? { stdout } : {}),
    };
  });

  return {
    results,
    passed: results.filter((r) => r.passed).length,
    total: results.length,
    crashed: false,
    ...(runtimeMs !== undefined ? { runtimeMs } : {}),
  };
}

export function crashedResult(
  problem: Problem,
  message: string,
  stdout = "",
  crashStage: "compile" | "run" = "compile"
): ExecutionResult {
  return {
    results: [],
    passed: 0,
    total: problem.testCases.length,
    crashed: true,
    crashOutput: message.slice(0, 2000),
    stdout: clampStdout(stdout),
    crashStage,
  };
}

/** Compiler and runtime diagnostics land on stderr; fall back to the error itself. */
export function errorText(err: unknown): string {
  if (err && typeof err === "object" && "killed" in err && err.killed) {
    return `Timed out after ${EXEC_OPTIONS.timeout / 1000}s. Is there an infinite loop?`;
  }
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
