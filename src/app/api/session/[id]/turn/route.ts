import { NextResponse } from "next/server";
import { addTurn, getSession, saveSession, updateCode } from "@/lib/store";
import { runInterviewerTurn } from "@/lib/agent/interviewer";
import { clientSession } from "@/lib/serialize";
import type { TurnTrigger } from "@/lib/types";

export const maxDuration = 60;

function parseTrigger(body: Record<string, unknown>): TurnTrigger | null {
  const kind = String(body.kind ?? "");
  switch (kind) {
    case "start":
      return { kind: "start" };
    case "candidate": {
      const text = String(body.text ?? "").trim();
      return text ? { kind: "candidate", text: text.slice(0, 4000) } : null;
    }
    case "silence": {
      const seconds = Math.max(1, Math.round(Number(body.seconds ?? 30)));
      return { kind: "silence", seconds };
    }
    case "code_change":
      return { kind: "code_change" };
    case "time_warning":
      return {
        kind: "time_warning",
        minutesLeft: Math.max(0, Math.round(Number(body.minutesLeft ?? 2))),
      };
    case "request_hint":
      return { kind: "request_hint" };
    default:
      return null;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Interview not found." }, { status: 404 });
  }
  if (session.endedAt) {
    return NextResponse.json({ error: "This interview has ended." }, { status: 409 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const trigger = parseTrigger(body);
  if (!trigger) {
    return NextResponse.json({ error: "Unrecognised or empty turn." }, { status: 400 });
  }

  if (typeof body.code === "string") {
    updateCode(session, body.code.slice(0, 100_000));
  }

  // The candidate's own words go on the record before the interviewer reacts.
  if (trigger.kind === "candidate") {
    addTurn(session, "candidate", trigger.text);
  }
  if (trigger.kind === "request_hint") {
    addTurn(session, "system", "Candidate asked for a hint");
  }

  const reply = await runInterviewerTurn(session, trigger);
  if (reply.speak) addTurn(session, "interviewer", reply.speak);

  await saveSession(session);

  return NextResponse.json({
    reply: {
      speak: reply.speak,
      hintLevel: reply.hintLevel,
      toolsUsed: reply.toolsUsed,
      offline: reply.offline,
    },
    session: clientSession(session),
  });
}
