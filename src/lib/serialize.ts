import type { RunResult, Session, TestResult } from "@/lib/types";
import { publicProblem } from "@/lib/problems";
import { elapsedMs, remainingMs } from "@/lib/store";

/**
 * Hidden tests are real tests the candidate must not be able to read while the
 * interview is live — seeing the inputs would turn an edge-case probe into a
 * lookup. Once the interview has ended they are revealed for the debrief.
 */
function projectTest(result: TestResult, reveal: boolean): TestResult {
  if (!result.hidden || reveal) return result;
  return {
    ...result,
    input: "hidden",
    expected: "hidden",
    actual: "hidden",
    stdout: "",
    error: result.error ? "hidden test failed" : null,
  };
}

function projectRun(run: RunResult, reveal: boolean): RunResult {
  return { ...run, results: run.results.map((r) => projectTest(r, reveal)) };
}

export function clientSession(session: Session) {
  const reveal = session.endedAt !== null;

  return {
    id: session.id,
    config: session.config,
    problem: publicProblem(session.problem),
    code: session.code,
    phase: session.phase,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    elapsedMs: elapsedMs(session),
    remainingMs: remainingMs(session),
    transcript: session.transcript,
    timeline: session.timeline,
    hints: session.hints,
    runs: session.runs.map((r) => projectRun(r, reveal)),
    report: session.report,
  };
}

export type ClientSession = ReturnType<typeof clientSession>;
