import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import {
  createSessionToken,
  isAuthConfigured,
  isValidPassword,
  safeNextPath,
  verifySessionToken,
} from "@/lib/auth/session";

const previousPassword = process.env.APP_PASSWORD;
const previousSecret = process.env.APP_AUTH_SECRET;

beforeEach(() => {
  process.env.APP_PASSWORD = "test-password";
  process.env.APP_AUTH_SECRET = "test-secret-with-enough-length";
});

afterEach(() => {
  if (previousPassword === undefined) delete process.env.APP_PASSWORD;
  else process.env.APP_PASSWORD = previousPassword;
  if (previousSecret === undefined) delete process.env.APP_AUTH_SECRET;
  else process.env.APP_AUTH_SECRET = previousSecret;
});

test("пароль проверяется без утечки сравнения", async () => {
  assert.equal(isAuthConfigured(), true);
  assert.equal(await isValidPassword("test-password"), true);
  assert.equal(await isValidPassword("wrong"), false);
  assert.equal(await isValidPassword(""), false);
});

test("сессионный токен подписывается и проверяется", async () => {
  const token = await createSessionToken();
  assert.ok(token.length > 20);
  assert.equal(await verifySessionToken(token), true);
  assert.equal(await verifySessionToken("broken"), false);
});

test("после смены пароля старая сессия недействительна", async () => {
  const token = await createSessionToken();
  process.env.APP_PASSWORD = "new-password";
  assert.equal(await verifySessionToken(token), false);
});

test("safeNextPath пропускает только внутренние пути", () => {
  assert.equal(safeNextPath("/groups?page=2"), "/groups?page=2");
  assert.equal(safeNextPath("https://evil.example"), "/");
  assert.equal(safeNextPath("//evil.example"), "/");
  assert.equal(safeNextPath("/api/secret"), "/");
  assert.equal(safeNextPath(undefined), "/");
});
