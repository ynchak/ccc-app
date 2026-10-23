import assert from "node:assert/strict";
import { test } from "node:test";

import { formatUsd, usageCost } from "@/lib/ai-cost";

test("стоимость берётся из usage OpenRouter", () => {
  assert.equal(usageCost({ cost: 0.00042 }), 0.00042);
  assert.equal(usageCost({ cost: 0 }), 0);
  assert.equal(usageCost({ cost: "bad" }), 0);
  assert.equal(usageCost(null), 0);
});

test("стоимость форматируется в долларах", () => {
  assert.equal(formatUsd(0.00042), "$0.00042");
});
