import "server-only";

import { cookies } from "next/headers";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdminApp } from "@/lib/firebase-admin";
import { SESSION_COOKIE } from "@/lib/session-cookie";

export type CurrentUser = { uid: string; email: string | null };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const decoded = await getAuth(getFirebaseAdminApp()).verifySessionCookie(cookie, true);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    return null;
  }
}
