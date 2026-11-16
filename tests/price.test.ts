import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatPrice,
  formatPriceSummary,
  formatPriceUah,
  parsePriceNumber,
  summarizePrices,
} from "@/lib/price";

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

test("к цене добавляется символ гривны", () => {
  assert.equal(formatPriceUah("1299.00"), "1299 ₴");
  assert.equal(formatPriceUah("1299,50"), "1299,5 ₴");
  assert.equal(formatPriceUah("1 299,00"), "1 299 ₴");
  assert.equal(formatPriceUah("1299 грн"), "1299 грн");
  assert.equal(formatPriceUah(""), "");
});

test("цена разбирается в число с пробелами и запятой", () => {
  assert.equal(parsePriceNumber("1299.00"), 1299);
  assert.equal(parsePriceNumber("1 299,50"), 1299.5);
  assert.equal(parsePriceNumber("0"), 0);
  assert.equal(parsePriceNumber("1299 грн"), null);
  assert.equal(parsePriceNumber(""), null);
});

test("сводка цен находит диапазон и пропуски", () => {
  const summary = summarizePrices(["1299.00", "1399.00", null, ""]);

  assert.deepEqual(summary.values, ["1299.00", "1399.00"]);
  assert.equal(summary.min, 1299);
  assert.equal(summary.max, 1399);
  assert.equal(summary.missing, 2);
  assert.equal(summary.total, 4);
  assert.equal(summary.numeric, true);
});

test("сводка цен сохраняет нечисловые значения", () => {
  const summary = summarizePrices(["1299 грн", "1399 грн"]);

  assert.deepEqual(summary.values, ["1299 грн", "1399 грн"]);
  assert.equal(summary.min, null);
  assert.equal(summary.max, null);
  assert.equal(summary.missing, 0);
  assert.equal(summary.numeric, false);
});

test("подпись цены показывает одну цену, диапазон или список", () => {
  assert.equal(
    formatPriceSummary(summarizePrices(["1299.00"])),
    "1299 ₴",
  );
  assert.equal(
    formatPriceSummary(summarizePrices(["1299.00", "1399.00"])),
    "1299–1399 ₴",
  );
  assert.equal(
    formatPriceSummary(summarizePrices(["1299 грн", "1399 грн"])),
    "1299 грн, 1399 грн",
  );
  assert.equal(
    formatPriceSummary(summarizePrices([])),
    "ціна не вказана",
  );
});
