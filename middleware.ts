import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CAMP_AUTH_COOKIE, isCampGateEnabled } from "@/lib/camp/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPlayRoute = pathname === "/play" || pathname.startsWith("/play/");
  if (isPlayRoute && isCampGateEnabled()) {
    const ok = request.cookies.get(CAMP_AUTH_COOKIE)?.value === "1";
    if (!ok) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", pathname + request.nextUrl.search);
      return NextResponse.redirect(login);
    }
  }

  if (pathname.startsWith("/camp")) {
    if (isCampGateEnabled()) {
      const ok = request.cookies.get(CAMP_AUTH_COOKIE)?.value === "1";
      if (!ok) {
        const login = new URL("/login", request.url);
        login.searchParams.set("next", pathname);
        return NextResponse.redirect(login);
      }
    }
  }

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return NextResponse.next();
  }
  const cookie = request.cookies.get("youthcamp_admin")?.value;
  if (cookie !== secret) {
    const login = new URL("/admin/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/camp",
    "/camp/:path*",
    "/play",
    "/play/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
