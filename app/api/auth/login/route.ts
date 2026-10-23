import { NextResponse, type NextRequest } from "next/server";

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  isAuthConfigured,
  isValidPassword,
  loginDelay,
  safeNextPath,
} from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "Авторизацію не налаштовано на сервері" },
      { status: 503 },
    );
  }

  let password = "";
  let next = "/";
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object") {
      const record = body as Record<string, unknown>;
      password = typeof record.password === "string" ? record.password : "";
      next = safeNextPath(
        typeof record.next === "string" ? record.next : undefined,
      );
    }
  } catch {
    // Ниже вернём ошибку входа.
  }

  if (!(await isValidPassword(password))) {
    await loginDelay();
    return NextResponse.json(
      { error: "Невірний пароль" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const token = await createSessionToken();
  const response = NextResponse.json(
    { ok: true, next },
    { headers: { "cache-control": "no-store" } },
  );
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production" ||
      request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
