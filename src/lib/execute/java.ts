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

const EMITTERS = `    static void emitStr(String s) {
        StringBuilder sb = new StringBuilder();
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"' || c == '\\\\') sb.append('\\\\').append(c);
            else sb.append(c);
        }
        sb.append('"');
        System.out.print(sb);
    }
    static void emitBool(boolean v) { System.out.print(v ? "true" : "false"); }
    static void emitIntArray(int[] v) {
        System.out.print("[");
        for (int i = 0; i < v.length; i++) { if (i > 0) System.out.print(","); System.out.print(v[i]); }
        System.out.print("]");
    }
    static void emitIntMatrix(int[][] v) {
        System.out.print("[");
        for (int i = 0; i < v.length; i++) { if (i > 0) System.out.print(","); emitIntArray(v[i]); }
        System.out.print("]");
    }
    static void open() { System.out.print("{\\"actual\\":"); }
    static void ok() { System.out.print(",\\"error\\":null}"); }
    static void failStart() { System.out.print("{\\"actual\\":null,\\"error\\":"); }
    static void failEnd() { System.out.print("}"); }
`;

function javaType(type: ValueType): string {
  switch (type) {
    case "int":
      return "int";
    case "bool":
      return "boolean";
    case "string":
      return "String";
    case "int[]":
      return "int[]";
    case "int[][]":
      return "int[][]";
  }
}

function javaLiteral(type: ValueType, value: unknown): string {
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

function emitCall(type: ValueType): string {
  switch (type) {
    case "int":
      return "System.out.print(_r);";
    case "bool":
      return "emitBool(_r);";
    case "string":
      return "emitStr(_r);";
    case "int[]":
      return "emitIntArray(_r);";
    case "int[][]":
      return "emitIntMatrix(_r);";
  }
}

function buildHarness(problem: Problem): string {
  const blocks = problem.testCases.map((testCase, i) => {
    const decls = testCase.args
      .map(
        (arg, j) =>
          `            ${javaType(problem.paramTypes[j]!)} _a${j} = ${javaLiteral(problem.paramTypes[j]!, arg)};`
      )
      .join("\n");
    const callArgs = testCase.args.map((_, j) => `_a${j}`).join(", ");
    return `        ${i > 0 ? 'System.out.print(",");\n        ' : ""}{
${decls}
            try {
                ${javaType(problem.returnType)} _r = sol.${problem.funcName}(${callArgs});
                open(); ${emitCall(problem.returnType)} ok();
            } catch (Throwable _t) {
                failStart(); emitStr(String.valueOf(_t)); failEnd();
            }
        }`;
  });

  return `import java.util.*;

public class Main {
${EMITTERS}
    public static void main(String[] args) {
        Solution sol = new Solution();
        System.out.print("[");
${blocks.join("\n")}
        System.out.println("]");
    }
}
`;
}

export async function runJava(
  problem: Problem,
  candidateCode: string
): Promise<ExecutionResult> {
  return withTempDir(async (dir) => {
    const classes = path.join(dir, "classes");
    await writeFile(path.join(dir, "Solution.java"), candidateCode, "utf8");
    await writeFile(path.join(dir, "Main.java"), buildHarness(problem), "utf8");

    try {
      await execFileAsync(
        "javac",
        ["-d", classes, path.join(dir, "Solution.java"), path.join(dir, "Main.java")],
        { timeout: COMPILE_TIMEOUT_MS, maxBuffer: EXEC_OPTIONS.maxBuffer }
      );
    } catch (err) {
      return crashedResult(problem, errorText(err));
    }

    try {
      const { stdout } = await execFileAsync("java", ["-cp", classes, "Main"], EXEC_OPTIONS);
      return toExecutionResult(problem, parseRawResults(stdout));
    } catch (err) {
      return crashedResult(problem, errorText(err));
    }
  });
}
