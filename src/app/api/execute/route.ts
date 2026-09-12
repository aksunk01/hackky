import { NextResponse } from "next/server";
import { getProblem } from "@/lib/problems";
import { runPython } from "@/lib/execute";

export async function POST(request: Request) {
  const body = await request.json();
  const { problemId, code } = body as { problemId?: string; code?: string };

  if (!problemId || typeof code !== "string") {
    return NextResponse.json(
      { error: "problemId and code are required." },
      { status: 400 }
    );
  }

  const problem = getProblem(problemId);
  if (!problem) {
    return NextResponse.json({ error: "Unknown problem." }, { status: 404 });
  }

  const result = await runPython(problem, code);
  return NextResponse.json(result);
}
