import { NextResponse } from "next/server";
import { ensureOwnerCookie } from "@/lib/owner-cookie";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  await ensureOwnerCookie();
  return NextResponse.json({ ready: true }, { headers: { "Cache-Control": "no-store" } });
}
