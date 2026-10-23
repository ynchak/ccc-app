import assert from "node:assert/strict";
import { test } from "node:test";

import { retryTransient } from "@/lib/retry";

test("retry повторяет временную ошибку и возвращает результат", async () => {
  let calls = 0;
  const result = await retryTransient(
    async () => {
      calls++;
      if (calls < 3) throw new Error("429");
      return "ok";
    },
    (error) => error instanceof Error && error.message === "429",
    3,
    1,
  );
  assert.equal(result, "ok");
  assert.equal(calls, 3);
});

test("retry не повторяет постоянную ошибку", async () => {
  let calls = 0;
  await assert.rejects(
    retryTransient(
      async () => {
        calls++;
        throw new Error("401");
      },
      () => false,
      3,
      1,
    ),
  );
  assert.equal(calls, 1);
});
