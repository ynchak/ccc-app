import assert from "node:assert/strict";
import { test } from "node:test";

import {
  colorIdsForWord,
  findColorIndexes,
  isColorModifier,
} from "@/lib/grouping/color-lexicon";

test("черный и black относятся к одному каноническому цвету", () => {
  assert.deepEqual(colorIdsForWord("черные"), ["black"]);
  assert.deepEqual(colorIdsForWord("Black"), ["black"]);
  assert.deepEqual(colorIdsForWord("чорні"), ["black"]);
});

test("Vintage не считается цветом", () => {
  assert.deepEqual(colorIdsForWord("Vintage"), []);
  assert.equal(isColorModifier("Vintage"), false);
});

test("цвет находится в составном токене", () => {
  const tokens = ["светло-бежевое", "пальто", "Vintage"];
  assert.deepEqual([...findColorIndexes(tokens, "Бежевый")], [0]);
  assert.equal(isColorModifier("светло"), true);
});

test("неизвестный цвет из поля цвета всё равно удаляется", () => {
  const tokens = ["Куртка", "ультрамарин"];
  assert.deepEqual([...findColorIndexes(tokens, "Ультрамарин")], [1]);
});
