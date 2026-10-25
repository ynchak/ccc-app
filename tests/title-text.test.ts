import assert from "node:assert/strict";
import { test } from "node:test";

import {
  capitalizeTitle,
  unescapeTitle,
} from "@/lib/grouping/title-text";

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

test("первая буква названия становится заглавной", () => {
  assert.equal(capitalizeTitle("шорти палаццо"), "Шорти палаццо");
  assert.equal(capitalizeTitle("Шорти палаццо"), "Шорти палаццо");
  assert.equal(capitalizeTitle("їжачок"), "Їжачок");
});

test("название с цифры или кавычки не меняется", () => {
  assert.equal(capitalizeTitle("2XL шорти"), "2XL шорти");
  assert.equal(capitalizeTitle('"Гірка" костюм'), '"Гірка" костюм');
  assert.equal(capitalizeTitle(""), "");
});
