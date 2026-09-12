import { NextResponse } from "next/server";
import { createSession } from "@/lib/store";
import { clientSession } from "@/lib/serialize";
import { getProblem } from "@/lib/problems";
import {
  DIFFICULTIES,
  LANGUAGES,
  STYLES,
  type Difficulty,
  type InterviewStyle,
  type Language,
} from "@/lib/types";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const language = body.language as Language;
  const difficulty = body.difficulty as Difficulty;
  const style = body.style as InterviewStyle;
  const problemId = String(body.problemId ?? "");

  if (!LANGUAGES.includes(language)) {
    return NextResponse.json({ error: `language must be one of ${LANGUAGES.join(", ")}` }, { status: 400 });
  }
  if (!DIFFICULTIES.includes(difficulty)) {
    return NextResponse.json({ error: `difficulty must be one of ${DIFFICULTIES.join(", ")}` }, { status: 400 });
  }
  if (!STYLES.includes(style)) {
    return NextResponse.json({ error: `style must be one of ${STYLES.join(", ")}` }, { status: 400 });
  }
  const problem = getProblem(problemId);
  if (!problem) {
    return NextResponse.json({ error: `Unknown problem: ${problemId}` }, { status: 400 });
  }

  const durationRaw = Number(body.durationMin ?? 20);
  const durationMin = Number.isFinite(durationRaw)
    ? Math.min(60, Math.max(5, Math.round(durationRaw)))
    : 20;

  const focusAreas = Array.isArray(body.focusAreas)
    ? (body.focusAreas as unknown[]).filter((f): f is string => typeof f === "string").slice(0, 5)
    : undefined;

  const session = await createSession({
    language,
    difficulty,
    style,
    problemId,
    durationMin,
    focusAreas,
  });

  return NextResponse.json({ session: clientSession(session) }, { status: 201 });
}
