import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyModelResults,
  normalizeTitleBeforeLlm,
  tokenizeTitle,
  type CleanTitleInput,
  type ModelTitleResult,
} from "@/lib/llm/title-cleanup";

const base: CleanTitleInput = {
  id: "1",
  title:
    "Женское серое худи New Balance Trackside Fleece Full Zip 34 (XS) (WJ62P2UPOFG)",
  brand: "New Balance",
  article: "WJ62P2UPOFG",
  size: "XS",
  color: "Серый",
  category: "Женские толстовки",
};

/** Собирает labels из списка индексов, которые нужно удалить. */
function labels(
  title: string,
  remove: Record<number, string>,
): string[] {
  return tokenizeTitle(title).map((_, index) => remove[index] ?? "other");
}

function model(
  input: CleanTitleInput,
  labelMap: Record<number, string>,
  confidence = 0.95,
): ModelTitleResult {
  return {
    id: input.id,
    labels: labels(input.title, labelMap),
    confidence,
  };
}

const issa: CleanTitleInput = {
  id: "issa",
  title:
    "Осеннее классическое удлиненное пальто с меховым воротником ISSA PLUS 15946 40 бежевое (issa2007682874996)",
  brand: "ISSA PLUS",
  article: "issa2007682874996",
  size: "40",
  color: "Бежевый",
  category: "Пальто",
};

test("токенизация сохраняет исходный порядок слов", () => {
  assert.deepEqual(tokenizeTitle("  Серое   худи  "), ["Серое", "худи"]);
});

test("разметка color/size удаляет цвет и размер, сохраняя артикул и бренд", () => {
  const [result] = applyModelResults(
    [base],
    [model(base, { 1: "color", 9: "size", 10: "size", 11: "article" })],
  );
  assert.equal(
    result.title,
    "Женское худи New Balance Trackside Fleece Full Zip (WJ62P2UPOFG)",
  );
  assert.deepEqual(result.removed, ["серое", "34", "(XS)"]);
  assert.equal(result.color, "серое");
});

test("article без скобок защищается по метке", () => {
  const input: CleanTitleInput = {
    id: "a",
    title: "Куртка ISSA PLUS 15952M черная SA-2609LP",
    brand: "ISSA PLUS",
    article: "SA-2609LP",
    size: "M",
    color: "Черный",
  };
  const [result] = applyModelResults(
    [input],
    [model(input, { 4: "color", 3: "model", 5: "article" })],
  );
  assert.equal(result.title, "Куртка ISSA PLUS 15952M SA-2609LP");
  assert.ok(!result.removed.includes("SA-2609LP"));
});

test("рост удаляется по метке height", () => {
  const input: CleanTitleInput = {
    id: "h",
    title: "Детский костюм ISSA PLUS 110-112 синий (issa123)",
    brand: "ISSA PLUS",
    size: "110-112",
    height: "110-112",
    color: "Синий",
  };
  const [result] = applyModelResults(
    [input],
    [model(input, { 4: "height", 5: "color" })],
  );
  assert.equal(result.title, "Детский костюм ISSA PLUS (issa123)");
});

test("2XL/XXL распознаётся моделью как размер", () => {
  const input: CleanTitleInput = {
    id: "xxl",
    title: "Теплый халат ISSA PLUS 15954 XXL бежевый (issa1)",
    brand: "ISSA PLUS",
    size: "2XL",
    color: "Бежевый",
  };
  const [result] = applyModelResults(
    [input],
    [model(input, { 5: "size", 6: "color" })],
  );
  assert.equal(result.title, "Теплый халат ISSA PLUS 15954 (issa1)");
});

test("составной цвет удаляется по метке color", () => {
  const input: CleanTitleInput = {
    id: "compound",
    title:
      "Классическое пальто ISSA PLUS 15906 36 светло-бежевое (issa2007682874637)",
    brand: "ISSA PLUS",
    size: "36",
    color: "Светлый бежевый",
  };
  const [result] = applyModelResults(
    [input],
    [model(input, { 5: "size", 6: "color" })],
  );
  assert.equal(
    result.title,
    "Классическое пальто ISSA PLUS 15906 (issa2007682874637)",
  );
  assert.equal(result.color, "светло-бежевое");
});

test("низкая уверенность не мешает детерминированному удалению размера", () => {
  const [result] = applyModelResults(
    [base],
    [model(base, { 1: "color", 9: "size" }, 0.2)],
  );
  assert.equal(
    result.title,
    "Женское серое худи New Balance Trackside Fleece Full Zip 34 (WJ62P2UPOFG)",
  );
  assert.deepEqual(result.removed, ["(XS)"]);
});

test("неполная разметка не применяется, но размер из данных удаляется", () => {
  const incomplete: ModelTitleResult = {
    id: base.id,
    labels: ["color"],
    confidence: 0.99,
  };
  const [result] = applyModelResults([base], [incomplete]);
  assert.equal(
    result.title,
    "Женское серое худи New Balance Trackside Fleece Full Zip 34 (WJ62P2UPOFG)",
  );
  assert.deepEqual(result.removed, ["(XS)"]);
});

test("номер модели перед размером не удаляется даже при ошибке модели", () => {
  const [result] = applyModelResults(
    [issa],
    [model(issa, { 9: "model", 10: "size", 11: "color" })],
  );
  assert.equal(
    result.title,
    "Осеннее классическое удлиненное пальто с меховым воротником ISSA PLUS 15946 (issa2007682874996)",
  );
  assert.ok(!result.removed.includes("15946"));
});

test("без модели размер из данных всё равно удаляется", () => {
  const [result] = applyModelResults([issa], []);
  assert.equal(
    result.title,
    "Осеннее классическое удлиненное пальто с меховым воротником ISSA PLUS 15946 бежевое (issa2007682874996)",
  );
  assert.deepEqual(result.removed, ["40"]);
});

test("при пустом size дополнительно ничего не удаляется", () => {
  const withoutSize: CleanTitleInput = { ...issa, size: undefined };
  const [result] = applyModelResults([withoutSize], []);
  assert.equal(result.title, withoutSize.title);
  assert.deepEqual(result.removed, []);
});

test("«см» удаляется вместе с соседним размером", () => {
  const shoes: CleanTitleInput = {
    id: "shoes",
    title: "Женские кроссовки New Balance 327 42,5 (10,5) 27,5 см (W32714Q)",
    brand: "New Balance",
    article: "W32714Q",
    size: "42,5",
    color: "Коричневый",
  };
  const [result] = applyModelResults(
    [shoes],
    [model(shoes, { 5: "size", 6: "size", 7: "size", 8: "size" })],
  );
  assert.equal(result.title, "Женские кроссовки New Balance 327 (W32714Q)");
});

test("нормалізація прибирає підписи розміру перед LLM", () => {
  assert.equal(
    normalizeTitleBeforeLlm("Боді з відкритою спинкою шоколад розмір M HDSYR_839"),
    "Боді з відкритою спинкою шоколад M HDSYR_839",
  );
  assert.equal(
    normalizeTitleBeforeLlm("Боді з відкритою спинкою РОЗМІР: HDSYR_839"),
    "Боді з відкритою спинкою HDSYR_839",
  );
  assert.equal(
    normalizeTitleBeforeLlm("Боді з відкритою спинкою (size) S HDSYR_839"),
    "Боді з відкритою спинкою S HDSYR_839",
  );
});

test("нормалізація прибирає форми розміру", () => {
  assert.equal(
    normalizeTitleBeforeLlm("Боді розміри M HDSYR_839"),
    "Боді M HDSYR_839",
  );
  assert.equal(
    normalizeTitleBeforeLlm("Боді розмірів M HDSYR_839"),
    "Боді M HDSYR_839",
  );
  assert.equal(
    normalizeTitleBeforeLlm("Боді размеры M HDSYR_839"),
    "Боді M HDSYR_839",
  );
  assert.equal(
    normalizeTitleBeforeLlm("Боді sizes M HDSYR_839"),
    "Боді M HDSYR_839",
  );
});

test("нормалізація не чіпає слово «розмірний»", () => {
  assert.equal(
    normalizeTitleBeforeLlm("Розмірний одяг розмір M"),
    "Розмірний одяг M",
  );
});

test("назви, що відрізняються лише словом розмір, стають однаковими", () => {
  const a = normalizeTitleBeforeLlm("Боді шоколад розмір M HDSYR_839");
  const b = normalizeTitleBeforeLlm("Боді шоколад S HDSYR_839");
  assert.equal(a.replace(" M ", " "), b.replace(" S ", " "));
});
