import { NextResponse, type NextRequest } from "next/server";

import {
  SESSION_COOKIE,
  isAuthConfigured,
  isAuthRequired,
  safeNextPath,
  verifySessionToken,
} from "@/lib/auth/session";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/auth/logout"]);

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // В dev без настроенного пароля приложение остаётся доступным.
  if (!isAuthRequired()) return NextResponse.next();

  // В production при отсутствии env — fail closed.
  if (!isAuthConfigured()) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Авторизация не настроена на сервере" },
        { status: 503 },
      );
    }
    if (pathname === "/login") return NextResponse.next();
    return new NextResponse("Авторизация не настроена на сервере", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const authenticated = await verifySessionToken(token);

  if (pathname === "/login") {
    if (authenticated) {
      const next = safeNextPath(request.nextUrl.searchParams.get("next"));
      return NextResponse.redirect(new URL(next, request.url));
    }
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  if (authenticated) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  const next = `${pathname}${search}`;
  if (next !== "/") loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?)$).*)",
  ],
};
