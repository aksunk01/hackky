import { NextResponse } from "next/server";
import {
  addEvent,
  addTurn,
  getSession,
  latestRun,
  recordRun,
  saveSession,
  updateCode,
} from "@/lib/store";
import { runTests } from "@/lib/runner";
import { runInterviewerTurn } from "@/lib/agent/interviewer";
import { clientSession } from "@/lib/serialize";

export const maxDuration = 60;

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

  const body = (await request.json().catch(() => ({}))) as {
    code?: unknown;
    react?: unknown;
  };
  if (typeof body.code === "string") {
    updateCode(session, body.code.slice(0, 100_000));
  }

  const previous = latestRun(session);
  const run = await runTests(
    session.problem,
    session.code,
    session.config.language,
    "candidate",
  );
  recordRun(session, run);

  // The timeline should record what changed, not just that a run happened.
  if (run.compileError) {
    addEvent(session, "bad", "Code failed to compile");
  } else if (run.passed === run.total) {
    if (!previous || previous.passed < previous.total) {
      addEvent(session, "good", `All ${run.total} tests passing`);
    }
  } else if (previous && !previous.compileError && run.passed > previous.passed) {
    addEvent(session, "good", `Fixed a failing case — now ${run.passed}/${run.total}`);
  } else if (previous && !previous.compileError && run.passed < previous.passed) {
    addEvent(session, "warn", `Regressed — now ${run.passed}/${run.total}`);
  } else {
    addEvent(session, "info", `Ran tests — ${run.passed}/${run.total} passing`);
  }

  // The interviewer sees the result and decides whether to say anything.
  let reply = null;
  if (body.react !== false) {
    reply = await runInterviewerTurn(session, { kind: "tests_ran", runId: run.id });
    if (reply.speak) addTurn(session, "interviewer", reply.speak);
  }

  await saveSession(session);

  return NextResponse.json({
    run: clientSession(session).runs.slice(-1)[0],
    reply: reply ? { speak: reply.speak, hintLevel: reply.hintLevel, offline: reply.offline } : null,
    session: clientSession(session),
  });
}
