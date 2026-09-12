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

const PRELUDE = `#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>
#include <limits.h>
#include <ctype.h>
`;

const EMITTERS = `// Results are written to a scratch file so the candidate's own prints can't interleave with them.
static FILE* _res;
static void _emitStr(const char* s) {
    fputc('"', _res);
    for (; *s; s++) {
        if (*s == '"' || *s == '\\\\') { fputc('\\\\', _res); fputc(*s, _res); }
        else fputc(*s, _res);
    }
    fputc('"', _res);
}
static void _emitInt(int v) { fprintf(_res, "%d", v); }
static void _emitBool(bool v) { fprintf(_res, v ? "true" : "false"); }
static void _emitIntArray(int* v, int n) {
    fputc('[', _res);
    for (int i = 0; i < n; i++) { if (i) fputc(',', _res); fprintf(_res, "%d", v[i]); }
    fputc(']', _res);
}
static void _emitIntMatrix(int** v, int n, int* cols) {
    fputc('[', _res);
    for (int i = 0; i < n; i++) { if (i) fputc(',', _res); _emitIntArray(v[i], cols[i]); }
    fputc(']', _res);
}
static void _open(void) { fprintf(_res, "{\\"actual\\":"); }
static void _ok(void) { fprintf(_res, ",\\"error\\":null}"); }
`;

/**
 * C has no container types, so arrays are passed the way C interview problems
 * always state them: a pointer plus its length, and for a matrix a pointer to
 * each row plus a per-row length array.
 */
function declareArg(type: ValueType, name: string, value: unknown): { decl: string; args: string[] } {
  switch (type) {
    case "int":
      return { decl: `int ${name} = ${value};`, args: [name] };
    case "bool":
      return { decl: `bool ${name} = ${value ? "true" : "false"};`, args: [name] };
    case "string":
      return { decl: `char ${name}[] = ${JSON.stringify(value)};`, args: [name] };
    case "int[]": {
      const row = value as number[];
      const decl =
        row.length > 0
          ? `int ${name}[] = {${row.join(", ")}};\n        int ${name}n = ${row.length};`
          : `int ${name}[1] = {0};\n        int ${name}n = 0;`;
      return { decl, args: [name, `${name}n`] };
    }
    case "int[][]": {
      const matrix = value as number[][];
      if (matrix.length === 0) {
        return {
          decl: `int* ${name}[1] = {NULL};\n        int ${name}n = 0;\n        int ${name}c[1] = {0};`,
          args: [name, `${name}n`, `${name}c`],
        };
      }
      const rows = matrix
        .map((row, i) => `int ${name}r${i}[] = {${row.join(", ")}};`)
        .join("\n        ");
      return {
        decl: [
          rows,
          `int* ${name}[] = {${matrix.map((_, i) => `${name}r${i}`).join(", ")}};`,
          `int ${name}n = ${matrix.length};`,
          `int ${name}c[] = {${matrix.map((row) => row.length).join(", ")}};`,
        ].join("\n        "),
        args: [name, `${name}n`, `${name}c`],
      };
    }
  }
}

/** The call plus the emit for it, including any out-params the return type needs. */
function callAndEmit(problem: TypedProblem, callArgs: string[]): string {
  const call = (extra: string[] = []) =>
    `${problem.funcName}(${[...callArgs, ...extra].join(", ")})`;

  switch (problem.returnType) {
    case "int":
      return `int _r = ${call()};
        _open(); _emitInt(_r); _ok();`;
    case "bool":
      return `bool _r = ${call()};
        _open(); _emitBool(_r); _ok();`;
    case "string":
      return `char* _r = ${call()};
        _open(); _emitStr(_r); _ok();`;
    case "int[]":
      return `int _rn = 0;
        int* _r = ${call(["&_rn"])};
        _open(); _emitIntArray(_r, _rn); _ok();`;
    case "int[][]":
      return `int _rn = 0;
        int* _rc = NULL;
        int** _r = ${call(["&_rn", "&_rc"])};
        _open(); _emitIntMatrix(_r, _rn, _rc); _ok();`;
  }
}

function buildHarness(problem: TypedProblem, candidateCode: string): string {
  const blocks = problem.testCases.map((testCase, i) => {
    const declared = testCase.args.map((arg, j) =>
      declareArg(problem.paramTypes[j]!, `_a${j}`, arg)
    );
    const decls = declared.map((d) => `        ${d.decl}`).join("\n");
    const callArgs = declared.flatMap((d) => d.args);
    return `    ${i > 0 ? "fputc(',', _res);\n    " : ""}fputs("\\n${CASE_MARKER}\\n", stdout);
    {
${decls}
        ${callAndEmit(problem, callArgs)}
    }`;
  });

  return `${PRELUDE}
${candidateCode}

${EMITTERS}
int main(void) {
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

export async function runC(
  problem: Problem,
  candidateCode: string
): Promise<ExecutionResult> {
  const typed = requireTypes(problem);
  if (!typed) return crashedResult(problem, "This problem doesn't support C yet.");

  return withTempDir(async (dir) => {
    const source = path.join(dir, "solution.c");
    const binary = path.join(dir, "solution");
    await writeFile(source, buildHarness(typed, candidateCode), "utf8");

    try {
      await execFileAsync("gcc", ["-std=c11", "-O1", "-o", binary, source], {
        timeout: COMPILE_TIMEOUT_MS,
        maxBuffer: EXEC_OPTIONS.maxBuffer,
      });
    } catch (err) {
      return crashedResult(problem, errorText(err));
    }

    return runHarness(problem, binary, []);
  });
}
