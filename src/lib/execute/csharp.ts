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
    static readonly StringBuilder Out = new StringBuilder();
    static void EmitStr(string s) {
        Out.Append('"');
        foreach (char c in s) {
            if (c == '"' || c == '\\\\') Out.Append('\\\\').Append(c);
            else Out.Append(c);
        }
        Out.Append('"');
    }
    static void EmitBool(bool v) { Out.Append(v ? "true" : "false"); }
    static void EmitIntArray(int[] v) {
        Out.Append("[");
        for (int i = 0; i < v.Length; i++) { if (i > 0) Out.Append(","); Out.Append(v[i]); }
        Out.Append("]");
    }
    static void EmitIntMatrix(int[][] v) {
        Out.Append("[");
        for (int i = 0; i < v.Length; i++) { if (i > 0) Out.Append(","); EmitIntArray(v[i]); }
        Out.Append("]");
    }
    static void Open() { Out.Append("{\\"actual\\":"); }
    static void Ok() { Out.Append(",\\"error\\":null}"); }
    static void FailStart() { Out.Append("{\\"actual\\":null,\\"error\\":"); }
    static void FailEnd() { Out.Append("}"); }
`;

function csharpType(type: ValueType): string {
  switch (type) {
    case "int":
      return "int";
    case "bool":
      return "bool";
    case "string":
      return "string";
    case "int[]":
      return "int[]";
    case "int[][]":
      return "int[][]";
  }
}

function csharpLiteral(type: ValueType, value: unknown): string {
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
      return `{${(value as number[][]).map((row) => `new int[] {${row.join(", ")}}`).join(", ")}}`;
  }
}

function emitCall(type: ValueType): string {
  switch (type) {
    case "int":
      return "Out.Append(_r);";
    case "bool":
      return "EmitBool(_r);";
    case "string":
      return "EmitStr(_r);";
    case "int[]":
      return "EmitIntArray(_r);";
    case "int[][]":
      return "EmitIntMatrix(_r);";
  }
}

function buildHarness(problem: TypedProblem): string {
  const blocks = problem.testCases.map((testCase, i) => {
    const decls = testCase.args
      .map(
        (arg, j) =>
          `            ${csharpType(problem.paramTypes[j]!)} _a${j} = ${csharpLiteral(problem.paramTypes[j]!, arg)};`
      )
      .join("\n");
    const callArgs = testCase.args.map((_, j) => `_a${j}`).join(", ");
    return `        ${i > 0 ? 'Out.Append(",");\n        ' : ""}Console.Write("\\n${CASE_MARKER}\\n");
        {
${decls}
            try {
                ${csharpType(problem.returnType)} _r = sol.${problem.funcName}(${callArgs});
                Open(); ${emitCall(problem.returnType)} Ok();
            } catch (Exception _e) {
                FailStart(); EmitStr(_e.Message); FailEnd();
            }
        }`;
  });

  return `using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

public static class Program {
${EMITTERS}
    public static void Main() {
        var sol = new Solution();
        Out.Append("[");
${blocks.join("\n")}
        Out.Append("]");
        Console.WriteLine();
        Console.WriteLine(Out.ToString());
    }
}
`;
}

/** Built against whichever SDK is installed, rather than a pinned version. */
async function targetFramework(): Promise<string> {
  const { stdout } = await execFileAsync("dotnet", ["--version"], {
    timeout: COMPILE_TIMEOUT_MS,
    maxBuffer: EXEC_OPTIONS.maxBuffer,
  });
  const major = Number.parseInt(stdout.trim().split(".")[0] ?? "", 10);
  return Number.isInteger(major) && major >= 6 ? `net${major}.0` : "net8.0";
}

function projectFile(framework: string): string {
  return `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>${framework}</TargetFramework>
    <AssemblyName>solution</AssemblyName>
    <RootNamespace>solution</RootNamespace>
    <Nullable>disable</Nullable>
    <ImplicitUsings>disable</ImplicitUsings>
    <InvariantGlobalization>true</InvariantGlobalization>
  </PropertyGroup>
</Project>
`;
}

export async function runCSharp(
  problem: Problem,
  candidateCode: string
): Promise<ExecutionResult> {
  const typed = requireTypes(problem);
  if (!typed) return crashedResult(problem, "This problem doesn't support C# yet.");

  return withTempDir(async (dir) => {
    let framework: string;
    try {
      framework = await targetFramework();
    } catch (err) {
      return crashedResult(problem, errorText(err));
    }

    await writeFile(path.join(dir, "solution.csproj"), projectFile(framework), "utf8");
    await writeFile(path.join(dir, "Solution.cs"), candidateCode, "utf8");
    await writeFile(path.join(dir, "Program.cs"), buildHarness(typed), "utf8");

    try {
      await execFileAsync(
        "dotnet",
        ["build", "solution.csproj", "-c", "Release", "-o", "out", "--nologo", "-v", "q"],
        { cwd: dir, timeout: COMPILE_TIMEOUT_MS, maxBuffer: EXEC_OPTIONS.maxBuffer }
      );
    } catch (err) {
      return crashedResult(problem, errorText(err));
    }

    return runHarness(problem, path.join(dir, "out", "solution"), []);
  });
}
