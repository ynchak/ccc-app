import assert from "node:assert/strict";
import { test } from "node:test";

import { unescapeTitle } from "@/lib/grouping/title-text";

test("экранированные кавычки в названии раскрываются", () => {
  assert.equal(
    unescapeTitle(
      "Женские черные шорты AC Fitted Short 5\\'\\' 42 (XL) (WB61E4GEBK)",
    ),
    "Женские черные шорты AC Fitted Short 5'' 42 (XL) (WB61E4GEBK)",
  );
});

test("экранированный апостроф внутри слова раскрывается", () => {
  assert.equal(unescapeTitle("шаль м\\'ятний"), "шаль м'ятний");
});

test("обычный текст не меняется", () => {
  assert.equal(
    unescapeTitle('Костюм "Гірка" розмір 50'),
    'Костюм "Гірка" розмір 50',
  );
});
