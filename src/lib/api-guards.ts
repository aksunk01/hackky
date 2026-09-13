import "server-only";

import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";

/** Rejects a mutating request whose Origin header doesn't match the request's own origin (basic CSRF guard). */
export function checkOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  return null;
}

/** Resolves the signed-in user, or a ready-to-return 401 response if there isn't one. */
export async function requireCurrentUser(): Promise<CurrentUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  return user;
}
