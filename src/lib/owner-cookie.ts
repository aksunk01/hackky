import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "interviewai_owner";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function validToken(value: string | undefined): value is string {
  return Boolean(value && TOKEN_PATTERN.test(value));
}

export async function getOwnerId(): Promise<Buffer | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return validToken(token) ? createHash("sha256").update(token).digest() : null;
}

export async function ensureOwnerCookie(): Promise<void> {
  const cookieStore = await cookies();
  if (validToken(cookieStore.get(COOKIE_NAME)?.value)) return;

  cookieStore.set(COOKIE_NAME, randomBytes(32).toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}
