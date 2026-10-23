import type { JevPair, JevPairResult } from "@/lib/jev/types";

export interface JevStatus {
  configured: boolean;
  model: string;
  promptVersion: string;
}

export class JevNotConfiguredError extends Error {}

export class JevRequestError extends Error {
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
  return "Ошибка проверки моделей";
}

export async function fetchJevStatus(): Promise<JevStatus> {
  const response = await fetch("/api/group-matches", {
    method: "GET",
    cache: "no-store",
  });
  if (response.status === 503) {
    throw new JevNotConfiguredError("Jev не настроен");
  }
  if (!response.ok) {
    throw new JevRequestError(await readError(response), response.status);
  }
  return (await response.json()) as JevStatus;
}

export async function matchPairsBatch(
  pairs: JevPair[],
): Promise<{
  results: JevPairResult[];
  model: string;
  promptVersion: string;
}> {
  const response = await fetch("/api/group-matches", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pairs }),
    cache: "no-store",
  });

  if (response.status === 401) {
    throw new JevRequestError("Сессия истекла. Войдите снова.", 401);
  }
  if (response.status === 503) {
    throw new JevNotConfiguredError("Jev не настроен");
  }
  if (!response.ok) {
    throw new JevRequestError(await readError(response), response.status);
  }

  return (await response.json()) as {
    results: JevPairResult[];
    model: string;
    promptVersion: string;
  };
}
