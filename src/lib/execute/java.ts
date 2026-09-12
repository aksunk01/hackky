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

const EMITTERS = `    // Results are buffered so the candidate's own prints can't interleave with them.
    static final StringBuilder out = new StringBuilder();
    static void emitStr(String s) {
        out.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"' || c == '\\\\') out.append('\\\\').append(c);
            else out.append(c);
        }
        out.append('"');
    }
    static void emitBool(boolean v) { out.append(v ? "true" : "false"); }
    static void emitIntArray(int[] v) {
        out.append("[");
        for (int i = 0; i < v.length; i++) { if (i > 0) out.append(","); out.append(v[i]); }
        out.append("]");
    }
    static void emitIntMatrix(int[][] v) {
        out.append("[");
        for (int i = 0; i < v.length; i++) { if (i > 0) out.append(","); emitIntArray(v[i]); }
        out.append("]");
    }
    static void open() { out.append("{\\"actual\\":"); }
    static void ok() { out.append(",\\"error\\":null}"); }
    static void failStart() { out.append("{\\"actual\\":null,\\"error\\":"); }
    static void failEnd() { out.append("}"); }
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
      return "out.append(_r);";
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

function buildHarness(problem: TypedProblem): string {
  const blocks = problem.testCases.map((testCase, i) => {
    const decls = testCase.args
      .map(
        (arg, j) =>
          `            ${javaType(problem.paramTypes[j]!)} _a${j} = ${javaLiteral(problem.paramTypes[j]!, arg)};`
      )
      .join("\n");
    const callArgs = testCase.args.map((_, j) => `_a${j}`).join(", ");
    return `        ${i > 0 ? 'out.append(",");\n        ' : ""}System.out.print("\\n${CASE_MARKER}\\n");
        {
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
        out.append("[");
${blocks.join("\n")}
        out.append("]");
        System.out.println();
        System.out.println(out);
    }
}
`;
}

export async function runJava(
  problem: Problem,
  candidateCode: string
): Promise<ExecutionResult> {
  const typed = requireTypes(problem);
  if (!typed) return crashedResult(problem, "This problem doesn't support Java yet.");

  return withTempDir(async (dir) => {
    const classes = path.join(dir, "classes");
    await writeFile(path.join(dir, "Solution.java"), candidateCode, "utf8");
    await writeFile(path.join(dir, "Main.java"), buildHarness(typed), "utf8");

    try {
      await execFileAsync(
        "javac",
        ["-d", classes, path.join(dir, "Solution.java"), path.join(dir, "Main.java")],
        { timeout: COMPILE_TIMEOUT_MS, maxBuffer: EXEC_OPTIONS.maxBuffer }
      );
    } catch (err) {
      return crashedResult(problem, errorText(err));
    }

    return runHarness(problem, "java", ["-cp", classes, "Main"]);
  });
}
