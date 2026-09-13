import "server-only";

import { getDb } from "@/lib/firestore";
import {
  normalizeEvaluation,
  type ChatTurn,
  type Evaluation,
  type InterviewSession,
  type SessionSummary,
} from "@/lib/interview-session-types";

const COLLECTION = "interview_sessions";

type SessionDoc = {
  ownerId: string;
  problemId: string;
  problemTitle: string;
  transcript: ChatTurn[];
  finalCode: string;
  evaluation: Evaluation;
  overallScore: number;
  testsPassed: number;
  testsTotal: number;
  mocked: boolean;
  startedAt: string;
  completedAt: string;
};

export type CompletedSessionInput = {
  id: string;
  ownerId: string;
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

function toSummary(id: string, doc: SessionDoc): SessionSummary {
  return {
    id,
    problemTitle: doc.problemTitle,
    overallScore: doc.overallScore,
    testsPassed: doc.testsPassed,
    testsTotal: doc.testsTotal,
    completedAt: doc.completedAt,
  };
}

export async function listSessions(ownerId: string): Promise<SessionSummary[]> {
  const snapshot = await getDb()
    .collection(COLLECTION)
    .where("ownerId", "==", ownerId)
    .get();
  return snapshot.docs
    .map((doc) => toSummary(doc.id, doc.data() as SessionDoc))
    .sort((a, b) => (a.completedAt < b.completedAt ? 1 : a.completedAt > b.completedAt ? -1 : 0));
}

export async function getSession(id: string, ownerId: string): Promise<InterviewSession | null> {
  const snapshot = await getDb().collection(COLLECTION).doc(id).get();
  if (!snapshot.exists) return null;
  const doc = snapshot.data() as SessionDoc;
  if (doc.ownerId !== ownerId) return null;
  return {
    ...toSummary(snapshot.id, doc),
    problemId: doc.problemId,
    transcript: doc.transcript,
    finalCode: doc.finalCode,
    evaluation: normalizeEvaluation(doc.evaluation),
    mocked: doc.mocked,
    startedAt: doc.startedAt,
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
  const docRef = getDb().collection(COLLECTION).doc(input.id);
  const doc: SessionDoc = {
    ownerId: input.ownerId,
    problemId: input.problemId,
    problemTitle: input.problemTitle,
    transcript: input.transcript,
    finalCode: input.finalCode,
    evaluation: input.evaluation,
    overallScore: input.evaluation.overall,
    testsPassed: input.testsPassed,
    testsTotal: input.testsTotal,
    mocked: input.mocked,
    startedAt: input.startedAt,
    completedAt: new Date().toISOString(),
  };
  try {
    await docRef.create(doc as unknown as FirebaseFirestore.DocumentData);
  } catch (error) {
    if ((error as { code?: number }).code !== 6 /* ALREADY_EXISTS */) throw error;
    const existing = await getSession(input.id, input.ownerId);
    if (!existing || !matchesSubmission(existing, input.problemId, input.finalCode, input.transcript)) {
      throw new SessionConflictError("This report ID belongs to another submission.");
    }
  }
}

