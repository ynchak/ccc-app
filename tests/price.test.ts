import assert from "node:assert/strict";
import { test } from "node:test";

import { formatPrice } from "@/lib/price";

test("незначащие нули после точки убираются", () => {
  assert.equal(formatPrice("1299.00"), "1299");
  assert.equal(formatPrice("1299.000"), "1299");
  assert.equal(formatPrice("0.00"), "0");
});

test("значащие копейки сохраняются", () => {
  assert.equal(formatPrice("1299.50"), "1299.5");
  assert.equal(formatPrice("1299.05"), "1299.05");
  assert.equal(formatPrice("1299,50"), "1299,5");
});

test("разделитель тысяч и запятая сохраняются", () => {
  assert.equal(formatPrice("1 299,00"), "1 299");
  assert.equal(formatPrice("12 999.10"), "12 999.1");
});

test("нечисловые значения не меняются", () => {
  assert.equal(formatPrice("1299 грн"), "1299 грн");
  assert.equal(formatPrice(""), "");
  assert.equal(formatPrice("  "), "");
});
