import type {
  CleanTitleInput,
  CleanTitleResult,
} from "@/lib/llm/title-cleanup";

export interface CleanupStatus {
  configured: boolean;
  model: string;
  promptVersion: string;
}

export class LlmNotConfiguredError extends Error {}

export class LlmRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (data && typeof data === "object" && "error" in data) {
      return String((data as { error?: unknown }).error);
    }
  } catch {
    // ignore
  }
  return "Помилка сервісу очищення назв";
}

/** Проверяет, настроена ли LLM на сервере. */
export async function fetchCleanupStatus(): Promise<CleanupStatus> {
  const response = await fetch("/api/clean-titles", {
    method: "GET",
    cache: "no-store",
  });
  if (response.status === 503) {
    throw new LlmNotConfiguredError("LLM не налаштована");
  }
  if (!response.ok) {
    throw new LlmRequestError(await readError(response), response.status);
  }
  return (await response.json()) as CleanupStatus;
}

/** Очищает батч названий групп через сервер. */
export async function cleanTitlesBatch(
  items: CleanTitleInput[],
): Promise<{ results: CleanTitleResult[]; model: string; promptVersion: string }> {
  const response = await fetch("/api/clean-titles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items }),
    cache: "no-store",
  });

  if (response.status === 401) {
    throw new LlmRequestError("Сесія завершилася. Увійдіть знову.", 401);
  }
  if (response.status === 503) {
    throw new LlmNotConfiguredError("LLM не налаштована");
  }
  if (!response.ok) {
    throw new LlmRequestError(await readError(response), response.status);
  }

  return (await response.json()) as {
    results: CleanTitleResult[];
    model: string;
    promptVersion: string;
  };
}
