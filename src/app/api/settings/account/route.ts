import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdminApp } from "@/lib/firebase-admin";
import { checkOrigin, requireCurrentUser } from "@/lib/api-guards";
import { deleteUserData } from "@/lib/users";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { describeDatabaseError } from "@/lib/firestore";

export async function DELETE(request: Request) {
  const originError = checkOrigin(request);
  if (originError) return originError;

  const user = await requireCurrentUser();
  if (user instanceof NextResponse) return user;

  try {
    await deleteUserData(user.uid);
    await getAuth(getFirebaseAdminApp()).deleteUser(user.uid);
  } catch (err) {
    return NextResponse.json({ error: describeDatabaseError(err) }, { status: 500 });
  }

  (await cookies()).delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
