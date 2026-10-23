/** Повторяет временно неудачный запрос с экспоненциальной задержкой. */
export async function retryTransient<T>(
  request: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  attempts = 3,
  baseDelayMs = 800,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await request();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts - 1 || !shouldRetry(error)) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, baseDelayMs * 2 ** attempt),
      );
    }
  }
  throw lastError;
}
