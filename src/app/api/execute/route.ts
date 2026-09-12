import { NextResponse } from "next/server";
import { isLanguage } from "@/lib/languages";
import { getProblem } from "@/lib/problems";
import { runCode } from "@/lib/execute";

export async function POST(request: Request) {
  const body = await request.json();
  const { problemId, code, language } = body as {
    problemId?: string;
    code?: string;
    language?: string;
  };

  if (!problemId || typeof code !== "string") {
    return NextResponse.json(
      { error: "problemId and code are required." },
      { status: 400 }
    );
  }

  if (!isLanguage(language)) {
    return NextResponse.json({ error: "Unsupported language." }, { status: 400 });
  }

  const problem = getProblem(problemId);
  if (!problem) {
    return NextResponse.json({ error: "Unknown problem." }, { status: 404 });
  }

  const result = await runCode(language, problem, code);
  return NextResponse.json(result);
}
