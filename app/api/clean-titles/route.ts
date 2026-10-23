import { NextResponse, type NextRequest } from "next/server";

import {
  SESSION_COOKIE,
  isAuthRequired,
  verifySessionToken,
} from "@/lib/auth/session";
import {
  CLEANUP_PROMPT_VERSION,
  CLEANUP_RESPONSE_SCHEMA,
  applyModelResults,
  buildCleanupMessages,
  type CleanTitleInput,
  type ModelTitleResult,
} from "@/lib/llm/title-cleanup";

export const maxDuration = 60;

const DEFAULT_MODEL = "anthropic/claude-haiku-5.5";
const MAX_ITEMS = 30;
const MAX_TITLE_LENGTH = 500;

function modelName(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
}

async function authorized(request: NextRequest): Promise<boolean> {
  if (!isAuthRequired()) return true;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

function readItems(body: unknown): CleanTitleInput[] | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.items) || record.items.length === 0) return null;
  if (record.items.length > MAX_ITEMS) return null;

  const items: CleanTitleInput[] = [];
  for (const raw of record.items) {
    if (!raw || typeof raw !== "object") return null;
    const item = raw as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    const title = typeof item.title === "string" ? item.title.trim() : "";
    if (!id || !title || title.length > MAX_TITLE_LENGTH) return null;
    items.push({
      id,
      title,
      brand: typeof item.brand === "string" ? item.brand : undefined,
      article: typeof item.article === "string" ? item.article : undefined,
      size: typeof item.size === "string" ? item.size : undefined,
      color: typeof item.color === "string" ? item.color : undefined,
      height: typeof item.height === "string" ? item.height : undefined,
      category: typeof item.category === "string" ? item.category : undefined,
    });
  }
  return items;
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Потрібна авторизація" }, { status: 401 });
  }
  const configured = Boolean(process.env.OPENROUTER_API_KEY);
  return NextResponse.json(
    {
      configured,
      model: modelName(),
      promptVersion: CLEANUP_PROMPT_VERSION,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Потрібна авторизація" }, { status: 401 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "LLM не налаштована: відсутній OPENROUTER_API_KEY" },
      { status: 503 },
    );
  }

  const items = readItems(await request.json().catch(() => null));
  if (!items) {
    return NextResponse.json(
      { error: "Некоректний запит" },
      { status: 400 },
    );
  }

  const model = modelName();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_SITE_URL || "https://akin.local",
        "X-Title": "Akin",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 4000,
        messages: buildCleanupMessages(items),
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "title_cleanup",
            strict: true,
            schema: CLEANUP_RESPONSE_SCHEMA,
          },
        },
      }),
    });
  } catch (error) {
    console.error(
      "[clean-titles] OpenRouter fetch failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "OpenRouter не відповів вчасно" },
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
            ? "OpenRouter тимчасово обмежив запити"
            : "OpenRouter повернув помилку",
      },
      { status },
    );
  }

  const payload: unknown = await response.json();
  const payloadRecord = payload as { usage?: unknown } | null;
  const usage = payloadRecord?.usage ?? null;
  let content: unknown;
  try {
    const record = payload as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    content = record.choices?.[0]?.message?.content;
  } catch {
    content = null;
  }

  if (typeof content !== "string") {
    return NextResponse.json(
      { error: "Некоректна відповідь LLM" },
      { status: 502 },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return NextResponse.json(
      { error: "LLM повернула невалідний JSON" },
      { status: 502 },
    );
  }

  const resultsValue = (parsed as { results?: unknown } | null)?.results;
  if (!Array.isArray(resultsValue)) {
    return NextResponse.json(
      { error: "LLM повернула неочікуваний формат" },
      { status: 502 },
    );
  }

  const modelResults: ModelTitleResult[] = [];
  for (const raw of resultsValue) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      !Array.isArray(record.labels) ||
      typeof record.confidence !== "number"
    ) {
      continue;
    }
    modelResults.push({
      id: record.id,
      labels: record.labels.filter(
        (value): value is string => typeof value === "string",
      ),
      confidence: record.confidence,
    });
  }

  const results = applyModelResults(items, modelResults);
  return NextResponse.json(
    { results, model, promptVersion: CLEANUP_PROMPT_VERSION, usage },
    { headers: { "cache-control": "no-store" } },
  );
}
