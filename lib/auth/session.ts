import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "ccc_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 дней

const encoder = new TextEncoder();

function authEnv(): { password: string; secret: string } | null {
  const password = process.env.APP_PASSWORD;
  const secret = process.env.APP_AUTH_SECRET;
  if (!password || !secret) return null;
  return { password, secret };
}

/** Настроена ли авторизация на сервере. */
export function isAuthConfigured(): boolean {
  return authEnv() !== null;
}

/** Доступна ли авторизация: в dev без env пускаем, в production — нет. */
export function isAuthRequired(): boolean {
  return isAuthConfigured() || process.env.NODE_ENV === "production";
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

/** Сравнение без утечки длины/префикса. */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [left, right] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

/** Проверяет общий пароль приложения. */
export async function isValidPassword(input: string): Promise<boolean> {
  const env = authEnv();
  if (!env || input.length === 0) return false;
  return safeEqual(input, env.password);
}

/** Ключ подписи зависит от секрета и пароля: смена пароля разлогинивает всех. */
async function signingKey(): Promise<Uint8Array> {
  const env = authEnv();
  if (!env) throw new Error("Auth is not configured");
  return sha256(`${env.secret}\n${env.password}`);
}

/** Создаёт подписанную сессионную куку. */
export async function createSessionToken(): Promise<string> {
  return new SignJWT({ scope: "app" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(await signingKey());
}

/** Проверяет сессионную куку. */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const result = await jwtVerify(token, await signingKey());
    return result.payload.scope === "app";
  } catch {
    return false;
  }
}

/** Разрешает только внутренние относительные пути для redirect. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/api/")) return "/";
  return value;
}

/** Небольшая задержка для неудачных попыток входа. */
export async function loginDelay(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 600));
}
