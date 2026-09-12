import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Problem } from "../problems";
import { CASE_MARKER, type ExecutionResult, runHarness, withTempDir } from "./common";

function buildHarness(problem: Problem, candidateCode: string): string {
  const argsJson = JSON.stringify(problem.testCases.map((t) => t.args));
  return `import json

${candidateCode}

_cases = json.loads(${JSON.stringify(argsJson)})
_out = []
for _args in _cases:
    print("\\n${CASE_MARKER}")
    try:
        _out.append({"actual": ${problem.funcName}(*_args), "error": None})
    except Exception as _e:
        _out.append({"actual": None, "error": str(_e)})
print("\\n" + json.dumps(_out))
`;
}

export async function runPython(
  problem: Problem,
  candidateCode: string
): Promise<ExecutionResult> {
  return withTempDir(async (dir) => {
    const file = path.join(dir, "solution.py");
    await writeFile(file, buildHarness(problem, candidateCode), "utf8");
    return runHarness(problem, "python3", [file]);
  });
}
