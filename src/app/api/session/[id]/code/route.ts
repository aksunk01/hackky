import { NextResponse } from "next/server";
import { getSession, saveSession, updateCode } from "@/lib/store";

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

  const body = (await request.json().catch(() => ({}))) as { code?: unknown };
  if (typeof body.code !== "string") {
    return NextResponse.json({ error: "code must be a string." }, { status: 400 });
  }

  updateCode(session, body.code.slice(0, 100_000));
  await saveSession(session);
  return NextResponse.json({ ok: true, codeUpdatedAt: session.codeUpdatedAt });
}
