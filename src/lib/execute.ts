import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { Problem } from "./problems";

const execFileAsync = promisify(execFile);

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

function buildHarness(problem: Problem, candidateCode: string): string {
  const testCasesJson = JSON.stringify(problem.testCases);
  return `
import json
import sys

${candidateCode}

_tests = json.loads(${JSON.stringify(testCasesJson)})
_results = []
for _t in _tests:
    _args = _t["args"]
    _expected = _t["expected"]
    try:
        _actual = ${problem.funcName}(*_args)
        _results.append({
            "args": _args,
            "expected": _expected,
            "actual": _actual,
            "passed": _actual == _expected,
        })
    except Exception as _e:
        _results.append({
            "args": _args,
            "expected": _expected,
            "actual": None,
            "passed": False,
            "error": str(_e),
        })

print(json.dumps(_results))
`;
}

export async function runPython(
  problem: Problem,
  candidateCode: string
): Promise<ExecutionResult> {
  const dir = await mkdtemp(path.join(tmpdir(), "interview-run-"));
  const file = path.join(dir, "solution.py");
  try {
    await writeFile(file, buildHarness(problem, candidateCode), "utf8");
    const { stdout } = await execFileAsync("python3", [file], {
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });
    const results = JSON.parse(stdout.trim().split("\n").pop() ?? "[]") as TestResult[];
    return {
      results,
      passed: results.filter((r) => r.passed).length,
      total: results.length,
      crashed: false,
    };
  } catch (err) {
    const message =
      err && typeof err === "object" && "stderr" in err
        ? String((err as { stderr?: string }).stderr)
        : String(err);
    return {
      results: [],
      passed: 0,
      total: problem.testCases.length,
      crashed: true,
      crashOutput: message.slice(0, 2000),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
