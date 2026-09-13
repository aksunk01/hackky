import "server-only";

import { getDb } from "@/lib/firestore";
import type { Problem, TestCase } from "@/lib/problems";

const COLLECTION = "problems";

type ProblemDoc = Omit<Problem, "testCases"> & { testCasesJson: string; order: number };

function fromDoc(data: ProblemDoc): Problem {
  const { testCasesJson, order, ...rest } = data;
  void order;
  return { ...rest, testCases: JSON.parse(testCasesJson) as TestCase[] };
}

export async function getAllProblems(): Promise<Problem[]> {
  const snapshot = await getDb().collection(COLLECTION).orderBy("order").get();
  return snapshot.docs.map((doc) => fromDoc(doc.data() as ProblemDoc));
}

export async function getProblem(id: string): Promise<Problem | undefined> {
  const snapshot = await getDb().collection(COLLECTION).doc(id).get();
  return snapshot.exists ? fromDoc(snapshot.data() as ProblemDoc) : undefined;
}
