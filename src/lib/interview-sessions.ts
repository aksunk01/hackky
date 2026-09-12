import "server-only";

import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/mysql";
import {
  normalizeEvaluation,
  type ChatTurn,
  type Evaluation,
  type InterviewSession,
  type SessionSummary,
} from "@/lib/interview-session-types";

type SummaryRow = RowDataPacket & {
  id: string;
  problem_title: string;
  overall_score: number;
  tests_passed: number;
  tests_total: number;
  completed_at: string;
};

type SessionRow = SummaryRow & {
  problem_id: string;
  transcript_json: ChatTurn[] | string;
  final_code: string;
  evaluation_json: unknown;
  mocked: number;
  started_at: string;
};

export type CompletedSessionInput = {
  id: string;
  ownerId: Buffer;
  problemId: string;
  problemTitle: string;
  transcript: ChatTurn[];
  finalCode: string;
  evaluation: Evaluation;
  testsPassed: number;
  testsTotal: number;
  mocked: boolean;
  startedAt: string;
};

export class SessionConflictError extends Error {}

function utcIso(value: string): string {
  return new Date(value.replace(" ", "T") + "Z").toISOString();
}

function jsonValue<T>(value: T | string): T {
  return typeof value === "string" ? (JSON.parse(value) as T) : value;
}

function toSummary(row: SummaryRow): SessionSummary {
  return {
    id: row.id,
    problemTitle: row.problem_title,
    overallScore: row.overall_score,
    testsPassed: row.tests_passed,
    testsTotal: row.tests_total,
    completedAt: utcIso(row.completed_at),
  };
}

export async function listSessions(ownerId: Buffer): Promise<SessionSummary[]> {
  const [rows] = await getPool().execute<SummaryRow[]>(
    `SELECT id, problem_title, overall_score, tests_passed, tests_total, completed_at
     FROM interview_sessions WHERE owner_id = ?
     ORDER BY completed_at DESC, id DESC`,
    [ownerId]
  );
  return rows.map(toSummary);
}

export async function getSession(id: string, ownerId: Buffer): Promise<InterviewSession | null> {
  const [rows] = await getPool().execute<SessionRow[]>(
    `SELECT id, problem_id, problem_title, transcript_json, final_code, evaluation_json,
            overall_score, tests_passed, tests_total, mocked, started_at, completed_at
     FROM interview_sessions WHERE id = ? AND owner_id = ?`,
    [id, ownerId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    ...toSummary(row),
    problemId: row.problem_id,
    transcript: jsonValue<ChatTurn[]>(row.transcript_json),
    finalCode: row.final_code,
    evaluation: normalizeEvaluation(jsonValue<unknown>(row.evaluation_json)),
    mocked: Boolean(row.mocked),
    startedAt: utcIso(row.started_at),
  };
}

export function matchesSubmission(
  session: InterviewSession,
  problemId: string,
  finalCode: string,
  transcript: ChatTurn[]
): boolean {
  const turns = (history: ChatTurn[]) => JSON.stringify(history.map(({ role, text }) => [role, text]));
  return (
    session.problemId === problemId &&
    session.finalCode === finalCode &&
    turns(session.transcript) === turns(transcript)
  );
}

export async function saveCompletedSession(input: CompletedSessionInput): Promise<void> {
  const startedAt = new Date(input.startedAt);
  const startedAtSql = startedAt.toISOString().slice(0, 23).replace("T", " ");
  try {
    await getPool().execute(
      `INSERT INTO interview_sessions
       (id, owner_id, problem_id, problem_title, transcript_json, final_code,
        evaluation_json, overall_score, tests_passed, tests_total, mocked, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
      [
        input.id,
        input.ownerId,
        input.problemId,
        input.problemTitle,
        JSON.stringify(input.transcript),
        input.finalCode,
        JSON.stringify(input.evaluation),
        input.evaluation.overall,
        input.testsPassed,
        input.testsTotal,
        input.mocked ? 1 : 0,
        startedAtSql,
      ]
    );
  } catch (error) {
    if ((error as { code?: string }).code !== "ER_DUP_ENTRY") throw error;
    const existing = await getSession(input.id, input.ownerId);
    if (!existing || !matchesSubmission(existing, input.problemId, input.finalCode, input.transcript)) {
      throw new SessionConflictError("This report ID belongs to another submission.");
    }
  }
}
