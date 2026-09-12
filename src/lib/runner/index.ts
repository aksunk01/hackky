import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import type { Language, Problem, RunResult, TestResult } from "@/lib/types";
import { buildHarness } from "./harness";
import { compareResult, formatArgs, formatValue } from "./compare";

const PER_TEST_MS = Number(process.env.RUNNER_TIMEOUT_MS ?? 6000);
const MAX_OUTPUT = Number(process.env.RUNNER_MAX_OUTPUT ?? 20000);
const COMPILE_MS = 30000;
const TOTAL_CAP_MS = 45000;

interface ExecOutcome {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

function exec(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<ExecOutcome> {
  return new Promise((resolve) => {
    // A deliberately bare environment — the candidate's code should not
    // inherit API keys or anything else from the server process.
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      PATH: process.env.PATH ?? "/usr/bin:/bin:/usr/local/bin",
      HOME: cwd,
      TMPDIR: cwd,
      LANG: "en_US.UTF-8",
      PYTHONIOENCODING: "utf-8",
      PYTHONDONTWRITEBYTECODE: "1",
    };

    const child = spawn(cmd, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"] as const,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (d) => {
      if (stdout.length < MAX_OUTPUT) stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      if (stderr.length < MAX_OUTPUT) stderr += d.toString();
    });

    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        code,
        stdout: stdout.slice(0, MAX_OUTPUT),
        stderr: stderr.slice(0, MAX_OUTPUT),
        timedOut,
      });
    };

    child.on("error", (err) => {
      stderr += `\n${err.message}`;
      finish(null);
    });
    child.on("close", (code) => finish(code));
  });
}

interface HarnessLine {
  i: number;
  ok: boolean;
  out: unknown;
  err: string | null;
  stdout?: string;
  ms: number;
}

/** Strips absolute temp paths so the candidate never sees server internals. */
function cleanTrace(text: string, dir: string): string {
  return text
    .split(dir)
    .join("")
    .replace(/\/private\/var\/folders\/\S+/g, "")
    .trim();
}

export async function runTests(
  problem: Problem,
  code: string,
  language: Language,
  trigger: "candidate" | "interviewer" = "candidate",
): Promise<RunResult> {
  const startedAt = Date.now();
  const plan = buildHarness(problem, code, language);
  const dir = await mkdtemp(join(tmpdir(), "interview-run-"));

  try {
    await Promise.all(
      Object.entries(plan.files).map(([name, content]) =>
        writeFile(join(dir, name), content, "utf8"),
      ),
    );

    let compileError: string | null = null;
    if (plan.compile) {
      const compiled = await exec(plan.compile.cmd, plan.compile.args, dir, COMPILE_MS);
      if (compiled.code !== 0) {
        compileError =
          cleanTrace(compiled.stderr || compiled.stdout, dir) ||
          (compiled.timedOut ? "Compilation timed out." : "Compilation failed.");
      }
    }

    let lines: HarnessLine[] = [];
    let runOutcome: ExecOutcome | null = null;

    if (!compileError) {
      const budget = Math.min(PER_TEST_MS * problem.tests.length, TOTAL_CAP_MS);
      runOutcome = await exec(plan.run.cmd, plan.run.args, dir, budget);

      const raw = await readFile(join(dir, plan.resultsFile), "utf8").catch(() => "");
      lines = raw
        .split("\n")
        .filter((l) => l.trim().length > 0)
        .map((l) => {
          try {
            return JSON.parse(l) as HarnessLine;
          } catch {
            return null;
          }
        })
        .filter((l): l is HarnessLine => l !== null);
    }

    const byIndex = new Map(lines.map((l) => [l.i, l]));

    // A runtime failure before any test reported (bad import, syntax error in an
    // interpreted language) shows up as stderr with no result lines at all.
    const globalError =
      !compileError && lines.length === 0 && runOutcome
        ? cleanTrace(runOutcome.stderr, dir) ||
          (runOutcome.timedOut ? "Execution timed out before any test finished." : null)
        : null;

    const results: TestResult[] = problem.tests.map((test, index) => {
      const line = byIndex.get(index);
      const label = test.label ?? `test ${index + 1}`;
      const input = formatArgs(problem.paramNames, test.args);
      const expected = formatValue(test.expected);
      const base = {
        index,
        label,
        hidden: Boolean(test.hidden),
        input,
        expected,
      };

      if (compileError) {
        return { ...base, passed: false, actual: "—", stdout: "", error: compileError, timedOut: false, ms: 0 };
      }
      if (!line) {
        const didNotRun = runOutcome?.timedOut
          ? "Timed out — this test never finished. An infinite loop or an algorithm too slow for the input size will do this."
          : globalError ?? "This test produced no result.";
        return {
          ...base,
          passed: false,
          actual: "—",
          stdout: "",
          error: didNotRun,
          timedOut: Boolean(runOutcome?.timedOut),
          ms: 0,
        };
      }
      if (!line.ok) {
        return {
          ...base,
          passed: false,
          actual: "—",
          stdout: (line.stdout ?? "").slice(0, 2000),
          error: cleanTrace(line.err ?? "Unknown error", dir),
          timedOut: false,
          ms: line.ms,
        };
      }

      const passed = compareResult(line.out, test.expected, problem.compare);
      return {
        ...base,
        passed,
        actual: formatValue(line.out),
        stdout: (line.stdout ?? "").slice(0, 2000),
        error: null,
        timedOut: false,
        ms: line.ms,
      };
    });

    const visible = results.filter((r) => !r.hidden);
    return {
      id: randomUUID(),
      at: startedAt,
      language,
      trigger,
      compiled: !compileError,
      compileError,
      results,
      passed: results.filter((r) => r.passed).length,
      total: results.length,
      visiblePassed: visible.filter((r) => r.passed).length,
      visibleTotal: visible.length,
      totalMs: Date.now() - startedAt,
    };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Which language toolchains are actually installed on this machine. */
export async function checkToolchains(): Promise<Record<Language, boolean>> {
  const probe = async (cmd: string, args: string[]) => {
    const out = await exec(cmd, args, tmpdir(), 8000);
    return out.code === 0;
  };
  const [javascript, python, java] = await Promise.all([
    probe("node", ["--version"]),
    probe("python3", ["--version"]),
    probe("javac", ["-version"]),
  ]);
  return { javascript, python, java };
}
