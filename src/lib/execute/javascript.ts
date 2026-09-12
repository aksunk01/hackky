import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Problem } from "../problems";
import { CASE_MARKER, type ExecutionResult, runHarness, withTempDir } from "./common";

function buildHarness(problem: Problem, candidateCode: string): string {
  const argsJson = JSON.stringify(problem.testCases.map((t) => t.args));
  return `${candidateCode}

const _cases = ${argsJson};
const _out = [];
for (const _args of _cases) {
  console.log("\\n${CASE_MARKER}");
  try {
    const _actual = ${problem.funcName}(..._args);
    _out.push({ actual: _actual === undefined ? null : _actual, error: null });
  } catch (_e) {
    _out.push({ actual: null, error: _e instanceof Error ? _e.message : String(_e) });
  }
}
console.log("\\n" + JSON.stringify(_out));
`;
}

export async function runJavaScript(
  problem: Problem,
  candidateCode: string
): Promise<ExecutionResult> {
  return withTempDir(async (dir) => {
    const file = path.join(dir, "solution.js");
    await writeFile(file, buildHarness(problem, candidateCode), "utf8");
    return runHarness(problem, "node", [file]);
  });
}
