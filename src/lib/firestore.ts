import "server-only";

import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "@/lib/firebase-admin";

export function getDb(): Firestore {
  return getFirestore(getFirebaseAdminApp());
}

export function describeDatabaseError(error: unknown): string {
  const coded = error as { code?: unknown; message?: unknown };
  if (typeof coded.message === "string" && coded.message.startsWith("Firebase is not configured.")) {
    return coded.message;
  }
  if (typeof coded.code === "number" || typeof coded.code === "string") return String(coded.code);
  return "unknown database error";
}
