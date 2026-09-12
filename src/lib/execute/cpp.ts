import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Problem, ValueType } from "../problems";
import {
  COMPILE_TIMEOUT_MS,
  EXEC_OPTIONS,
  type ExecutionResult,
  crashedResult,
  errorText,
  execFileAsync,
  parseRawResults,
  toExecutionResult,
  withTempDir,
} from "./common";

const PRELUDE = `#include <cstdio>
#include <string>
#include <vector>
#include <algorithm>
#include <map>
#include <set>
#include <unordered_map>
#include <unordered_set>
#include <queue>
#include <stack>
#include <climits>
#include <cmath>
#include <exception>
using namespace std;
`;

/** Prints each result as the {"actual":…,"error":…} object the runner expects. */
const EMITTERS = `static void _emitStr(const string& s) {
    putchar('"');
    for (char c : s) {
        if (c == '"' || c == '\\\\') { putchar('\\\\'); putchar(c); }
        else putchar(c);
    }
    putchar('"');
}
static void _emit(int v) { printf("%d", v); }
static void _emit(bool v) { printf(v ? "true" : "false"); }
static void _emit(const string& v) { _emitStr(v); }
static void _emit(const vector<int>& v) {
    putchar('[');
    for (size_t i = 0; i < v.size(); i++) { if (i) putchar(','); printf("%d", v[i]); }
    putchar(']');
}
static void _emit(const vector<vector<int>>& v) {
    putchar('[');
    for (size_t i = 0; i < v.size(); i++) { if (i) putchar(','); _emit(v[i]); }
    putchar(']');
}
static void _open() { printf("{\\"actual\\":"); }
static void _ok() { printf(",\\"error\\":null}"); }
static void _failStart() { printf("{\\"actual\\":null,\\"error\\":"); }
static void _failEnd() { printf("}"); }
`;

function cppType(type: ValueType): string {
  switch (type) {
    case "int":
      return "int";
    case "bool":
      return "bool";
    case "string":
      return "string";
    case "int[]":
      return "vector<int>";
    case "int[][]":
      return "vector<vector<int>>";
  }
}

function cppLiteral(type: ValueType, value: unknown): string {
  switch (type) {
    case "int":
      return String(value);
    case "bool":
      return value ? "true" : "false";
    case "string":
      return JSON.stringify(value);
    case "int[]":
      return `{${(value as number[]).join(", ")}}`;
    case "int[][]":
      return `{${(value as number[][]).map((row) => `{${row.join(", ")}}`).join(", ")}}`;
  }
}

function buildHarness(problem: Problem, candidateCode: string): string {
  const blocks = problem.testCases.map((testCase, i) => {
    const decls = testCase.args
      .map(
        (arg, j) =>
          `        ${cppType(problem.paramTypes[j]!)} _a${j} = ${cppLiteral(problem.paramTypes[j]!, arg)};`
      )
      .join("\n");
    const callArgs = testCase.args.map((_, j) => `_a${j}`).join(", ");
    return `    ${i > 0 ? "putchar(',');\n    " : ""}{
${decls}
        try {
            ${cppType(problem.returnType)} _r = ${problem.funcName}(${callArgs});
            _open(); _emit(_r); _ok();
        } catch (const exception& _e) {
            _failStart(); _emitStr(_e.what()); _failEnd();
        } catch (...) {
            _failStart(); _emitStr("unknown error"); _failEnd();
        }
    }`;
  });

  return `${PRELUDE}
${candidateCode}

${EMITTERS}
int main() {
    putchar('[');
${blocks.join("\n")}
    printf("]\\n");
    return 0;
}
`;
}

export async function runCpp(
  problem: Problem,
  candidateCode: string
): Promise<ExecutionResult> {
  return withTempDir(async (dir) => {
    const source = path.join(dir, "solution.cpp");
    const binary = path.join(dir, "solution");
    await writeFile(source, buildHarness(problem, candidateCode), "utf8");

    try {
      await execFileAsync("g++", ["-std=c++17", "-O1", "-o", binary, source], {
        timeout: COMPILE_TIMEOUT_MS,
        maxBuffer: EXEC_OPTIONS.maxBuffer,
      });
    } catch (err) {
      return crashedResult(problem, errorText(err));
    }

    try {
      const { stdout } = await execFileAsync(binary, [], EXEC_OPTIONS);
      return toExecutionResult(problem, parseRawResults(stdout));
    } catch (err) {
      return crashedResult(problem, errorText(err));
    }
  });
}
