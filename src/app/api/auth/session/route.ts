import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdminApp } from "@/lib/firebase-admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/session-cookie";
import { upsertUserProfile } from "@/lib/users";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const { idToken } = (await request.json()) as { idToken?: string };
  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "idToken is required." }, { status: 400 });
  }

  try {
    const auth = getAuth(getFirebaseAdminApp());
    const decoded = await auth.verifyIdToken(idToken);
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
    await upsertUserProfile({
      uid: decoded.uid,
      email: decoded.email ?? null,
      displayName: decoded.name ?? null,
      photoURL: decoded.picture ?? null,
    });
    (await cookies()).set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Session creation failed:", err);
    return NextResponse.json({ error: "Could not establish a session." }, { status: 401 });
  }
}
