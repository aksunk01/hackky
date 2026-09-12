import { NextResponse } from "next/server";
import { addEvent, getSession, saveSession, updateCode } from "@/lib/store";
import { generateReport } from "@/lib/agent/assessment";
import { clientSession } from "@/lib/serialize";

export const maxDuration = 120;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Interview not found." }, { status: 404 });
  }

  // Ending twice is a no-op rather than an error — the UI may retry.
  if (session.endedAt && session.report) {
    return NextResponse.json({ session: clientSession(session) });
  }

  const body = (await request.json().catch(() => ({}))) as { code?: unknown };
  if (typeof body.code === "string" && !session.endedAt) {
    updateCode(session, body.code.slice(0, 100_000));
  }

  if (!session.endedAt) {
    session.endedAt = Date.now();
    session.phase = "ended";
    addEvent(session, "info", "Interview ended");
    await saveSession(session);
  }

  session.report = await generateReport(session);
  await saveSession(session);

  return NextResponse.json({ session: clientSession(session) });
}
