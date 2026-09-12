import type { Language } from "../languages";
import type { Problem } from "../problems";
import type { ExecutionResult } from "./common";
import { runC } from "./c";
import { runCpp } from "./cpp";
import { runCSharp } from "./csharp";
import { runJava } from "./java";
import { runJavaScript } from "./javascript";
import { runPython } from "./python";

export type { ExecutionResult, TestResult } from "./common";

export function runCode(
  language: Language,
  problem: Problem,
  code: string
): Promise<ExecutionResult> {
  switch (language) {
    case "python":
      return runPython(problem, code);
    case "javascript":
      return runJavaScript(problem, code);
    case "cpp":
      return runCpp(problem, code);
    case "c":
      return runC(problem, code);
    case "java":
      return runJava(problem, code);
    case "csharp":
      return runCSharp(problem, code);
  }
}
