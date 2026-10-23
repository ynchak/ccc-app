import { NextResponse, type NextRequest } from "next/server";

import {
  SESSION_COOKIE,
  isAuthRequired,
  verifySessionToken,
} from "@/lib/auth/session";
import {
  DEFAULT_JEV_MODEL,
  JEV_PROMPT_VERSION,
  buildJevRequestBody,
  parseJevAnswers,
} from "@/lib/jev/system-one";
import type { JevPair, JevGroupProfile } from "@/lib/jev/types";

export const maxDuration = 60;

const MAX_PAIRS = 30;
const MAX_TEXT_LENGTH = 500;
const MAX_EXAMPLES = 3;

function modelName(): string {
  return process.env.OPENROUTER_JEV_MODEL?.trim() || DEFAULT_JEV_MODEL;
}

async function authorized(request: NextRequest): Promise<boolean> {
  if (!isAuthRequired()) return true;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

function readProfile(value: unknown): JevGroupProfile | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (!id || !title || title.length > MAX_TEXT_LENGTH) return null;

  const text = (key: string): string | undefined => {
    const raw = record[key];
    if (typeof raw !== "string") return undefined;
    const trimmed = raw.trim();
    return trimmed ? trimmed.slice(0, MAX_TEXT_LENGTH) : undefined;
  };

  const examples = Array.isArray(record.examples)
    ? record.examples
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, MAX_TEXT_LENGTH))
        .filter(Boolean)
        .slice(0, MAX_EXAMPLES)
    : undefined;

  return {
    id,
    title,
    rawTitle: text("rawTitle"),
    category: text("category"),
    brand: text("brand"),
    mdg: text("mdg"),
    article: text("article"),
    examples,
  };
}

function readPairs(body: unknown): JevPair[] | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.pairs) || record.pairs.length === 0) return null;
  if (record.pairs.length > MAX_PAIRS) return null;

  const pairs: JevPair[] = [];
  for (const raw of record.pairs) {
    if (!raw || typeof raw !== "object") return null;
    const pairRecord = raw as Record<string, unknown>;
    const a = readProfile(pairRecord.a);
    const b = readProfile(pairRecord.b);
    if (!a || !b || a.id === b.id) return null;
    pairs.push({ a, b });
  }
  return pairs;
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  return NextResponse.json(
    {
      configured: Boolean(process.env.OPENROUTER_API_KEY),
      model: modelName(),
      promptVersion: JEV_PROMPT_VERSION,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Jev не настроен: отсутствует OPENROUTER_API_KEY" },
      { status: 503 },
    );
  }

  const pairs = readPairs(await request.json().catch(() => null));
  if (!pairs) {
    return NextResponse.json(
      { error: "Некорректный запрос" },
      { status: 400 },
    );
  }

  const model = modelName();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/systemone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_SITE_URL || "https://skladka.local",
        "X-Title": "Skladka",
      },
      signal: controller.signal,
      body: JSON.stringify(buildJevRequestBody(pairs, model)),
    });
  } catch (error) {
    console.error(
      "[group-matches] OpenRouter Jev fetch failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "Jev не ответил вовремя" },
      { status: 504 },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const status =
      response.status === 401
        ? 502
        : response.status === 429
          ? 429
          : 502;
    return NextResponse.json(
      {
        error:
          status === 429
            ? "OpenRouter временно ограничил запросы"
            : "OpenRouter вернул ошибку Jev",
      },
      { status },
    );
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { error: "Некорректный ответ Jev" },
      { status: 502 },
    );
  }

  const results = parseJevAnswers(pairs, payload);
  if (results.length === 0) {
    return NextResponse.json(
      { error: "Jev не вернул результаты" },
      { status: 502 },
    );
  }

  const record = payload as {
    model?: unknown;
    usage?: unknown;
  };

  return NextResponse.json(
    {
      results,
      model:
        typeof record.model === "string" && record.model
          ? record.model
          : model,
      promptVersion: JEV_PROMPT_VERSION,
      usage: record.usage ?? null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
