import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";

const PROTECTED_PREFIXES = ["/problems", "/interview", "/sessions"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  const isLogin = pathname === "/login";
  if (!isProtected && !isLogin) return NextResponse.next();

  const user = await getCurrentUser();

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  if (isLogin && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/problems";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/problems/:path*", "/interview/:path*", "/sessions/:path*", "/login"],
};
