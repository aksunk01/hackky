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

const EMITTERS = `    static void EmitStr(string s) {
        var sb = new StringBuilder();
        sb.Append('"');
        foreach (char c in s) {
            if (c == '"' || c == '\\\\') sb.Append('\\\\').Append(c);
            else sb.Append(c);
        }
        sb.Append('"');
        Console.Write(sb.ToString());
    }
    static void EmitBool(bool v) { Console.Write(v ? "true" : "false"); }
    static void EmitIntArray(int[] v) {
        Console.Write("[");
        for (int i = 0; i < v.Length; i++) { if (i > 0) Console.Write(","); Console.Write(v[i]); }
        Console.Write("]");
    }
    static void EmitIntMatrix(int[][] v) {
        Console.Write("[");
        for (int i = 0; i < v.Length; i++) { if (i > 0) Console.Write(","); EmitIntArray(v[i]); }
        Console.Write("]");
    }
    static void Open() { Console.Write("{\\"actual\\":"); }
    static void Ok() { Console.Write(",\\"error\\":null}"); }
    static void FailStart() { Console.Write("{\\"actual\\":null,\\"error\\":"); }
    static void FailEnd() { Console.Write("}"); }
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
      return "Console.Write(_r);";
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

function buildHarness(problem: Problem): string {
  const blocks = problem.testCases.map((testCase, i) => {
    const decls = testCase.args
      .map(
        (arg, j) =>
          `            ${csharpType(problem.paramTypes[j]!)} _a${j} = ${csharpLiteral(problem.paramTypes[j]!, arg)};`
      )
      .join("\n");
    const callArgs = testCase.args.map((_, j) => `_a${j}`).join(", ");
    return `        ${i > 0 ? 'Console.Write(",");\n        ' : ""}{
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
        Console.Write("[");
${blocks.join("\n")}
        Console.WriteLine("]");
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
  return withTempDir(async (dir) => {
    let framework: string;
    try {
      framework = await targetFramework();
    } catch (err) {
      return crashedResult(problem, errorText(err));
    }

    await writeFile(path.join(dir, "solution.csproj"), projectFile(framework), "utf8");
    await writeFile(path.join(dir, "Solution.cs"), candidateCode, "utf8");
    await writeFile(path.join(dir, "Program.cs"), buildHarness(problem), "utf8");

    try {
      await execFileAsync(
        "dotnet",
        ["build", "solution.csproj", "-c", "Release", "-o", "out", "--nologo", "-v", "q"],
        { cwd: dir, timeout: COMPILE_TIMEOUT_MS, maxBuffer: EXEC_OPTIONS.maxBuffer }
      );
    } catch (err) {
      return crashedResult(problem, errorText(err));
    }

    try {
      const { stdout } = await execFileAsync(
        path.join(dir, "out", "solution"),
        [],
        EXEC_OPTIONS
      );
      return toExecutionResult(problem, parseRawResults(stdout));
    } catch (err) {
      return crashedResult(problem, errorText(err));
    }
  });
}
