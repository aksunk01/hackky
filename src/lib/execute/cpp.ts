import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Problem, ValueType } from "../problems";
import {
  CASE_MARKER,
  COMPILE_TIMEOUT_MS,
  EXEC_OPTIONS,
  type ExecutionResult,
  type TypedProblem,
  crashedResult,
  errorText,
  execFileAsync,
  requireTypes,
  runHarness,
  withTempDir,
} from "./common";

const PRELUDE = `#include <cstdio>
#include <iostream>
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
const EMITTERS = `// Results are written to a scratch file so the candidate's own prints can't interleave with them.
static FILE* _res;
static void _emitStr(const string& s) {
    fputc('"', _res);
    for (char c : s) {
        if (c == '"' || c == '\\\\') { fputc('\\\\', _res); fputc(c, _res); }
        else fputc(c, _res);
    }
    fputc('"', _res);
}
static void _emit(int v) { fprintf(_res, "%d", v); }
static void _emit(bool v) { fprintf(_res, v ? "true" : "false"); }
static void _emit(const string& v) { _emitStr(v); }
static void _emit(const vector<int>& v) {
    fputc('[', _res);
    for (size_t i = 0; i < v.size(); i++) { if (i) fputc(',', _res); fprintf(_res, "%d", v[i]); }
    fputc(']', _res);
}
static void _emit(const vector<vector<int>>& v) {
    fputc('[', _res);
    for (size_t i = 0; i < v.size(); i++) { if (i) fputc(',', _res); _emit(v[i]); }
    fputc(']', _res);
}
static void _open() { fprintf(_res, "{\\"actual\\":"); }
static void _ok() { fprintf(_res, ",\\"error\\":null}"); }
static void _failStart() { fprintf(_res, "{\\"actual\\":null,\\"error\\":"); }
static void _failEnd() { fprintf(_res, "}"); }
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

function buildHarness(problem: TypedProblem, candidateCode: string): string {
  const blocks = problem.testCases.map((testCase, i) => {
    const decls = testCase.args
      .map(
        (arg, j) =>
          `        ${cppType(problem.paramTypes[j]!)} _a${j} = ${cppLiteral(problem.paramTypes[j]!, arg)};`
      )
      .join("\n");
    const callArgs = testCase.args.map((_, j) => `_a${j}`).join(", ");
    return `    ${i > 0 ? "fputc(',', _res);\n    " : ""}fputs("\\n${CASE_MARKER}\\n", stdout);
    {
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
    _res = tmpfile();
    fputc('[', _res);
${blocks.join("\n")}
    fputc(']', _res);
    rewind(_res);
    putchar('\\n');
    for (int c; (c = fgetc(_res)) != EOF;) putchar(c);
    putchar('\\n');
    return 0;
}
`;
}

export async function runCpp(
  problem: Problem,
  candidateCode: string
): Promise<ExecutionResult> {
  const typed = requireTypes(problem);
  if (!typed) return crashedResult(problem, "This problem doesn't support C++ yet.");

  return withTempDir(async (dir) => {
    const source = path.join(dir, "solution.cpp");
    const binary = path.join(dir, "solution");
    await writeFile(source, buildHarness(typed, candidateCode), "utf8");

    try {
      await execFileAsync("g++", ["-std=c++17", "-O1", "-o", binary, source], {
        timeout: COMPILE_TIMEOUT_MS,
        maxBuffer: EXEC_OPTIONS.maxBuffer,
      });
    } catch (err) {
      return crashedResult(problem, errorText(err));
    }

    return runHarness(problem, binary, []);
  });
}
