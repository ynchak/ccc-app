import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildJevGroupProfile,
  candidateLimitFor,
  generateCandidatePairs,
} from "@/lib/jev/candidates";
import { applyJevDecisions } from "@/lib/jev/merge";
import {
  buildJevRequestBody,
  parseJevAnswers,
} from "@/lib/jev/system-one";
import type { JevPair } from "@/lib/jev/types";
import type { Group, Product } from "@/lib/types";

function product(
  id: number,
  overrides: Partial<Product> = {},
): Product {
  return {
    id,
    datasetId: 1,
    order: id,
    goodsId: String(id),
    goodsTitle: `Товар ${id}`,
    goodsArticle: `art-${id}`,
    producersTitle: "ISSA PLUS",
    categoryId: "cat-1",
    categoryTitle: "Пальто",
    sellerTitle: "",
    gomerSyncSourceId: "",
    mdg: null,
    description: null,
    size: null,
    color: null,
    height: null,
    ean: null,
    imageUrls: [],
    ...overrides,
  };
}

function group(
  id: number,
  productIds: number[],
  overrides: Partial<Group> = {},
): Group {
  return {
    id,
    datasetId: 1,
    number: id,
    title: `Группа ${id}`,
    titleRaw: `Группа ${id}`,
    titleKey: `группа ${id}`,
    titleSource: "derived",
    categoryId: "cat-1",
    categoryTitle: "Пальто",
    productIds,
    order: id,
    ...overrides,
  };
}

function pair(
  a: Group,
  b: Group,
  products: Map<number, Product>,
): JevPair {
  const pa = buildJevGroupProfile(a, products);
  const pb = buildJevGroupProfile(b, products);
  assert.ok(pa && pb);
  return { a: pa, b: pb };
}

test("кандидаты: общий код модели внутри категории", () => {
  const products = new Map<number, Product>([
    [1, product(1, { goodsTitle: "Пальто женское ISSA PLUS 15946" })],
    [2, product(2, { goodsTitle: "Пальто-миди ISSA PLUS 15946" })],
  ]);
  const groups = [group(1, [1]), group(2, [2])];
  const pairs = generateCandidatePairs(groups, products);
  assert.equal(pairs.length, 1);
  assert.deepEqual(
    [pairs[0].aId, pairs[0].bId],
    [1, 2],
  );
});

test("кандидаты: общая часть артикула связывает разные названия", () => {
  const products = new Map<number, Product>([
    [
      1,
      product(1, {
        goodsTitle: "Куртка Zara 18738 синяя",
        goodsArticle: "4302207-navyblue-XXL",
      }),
    ],
    [
      2,
      product(2, {
        goodsTitle: "Куртка Zara 18743 серая",
        goodsArticle: "4302207-stone-L",
      }),
    ],
  ]);
  const groups = [group(1, [1]), group(2, [2])];
  const first = buildJevGroupProfile(groups[0], products);
  const second = buildJevGroupProfile(groups[1], products);
  assert.equal(first?.articleBase, "4302207");
  assert.equal(second?.articleBase, "4302207");

  const pairs = generateCandidatePairs(groups, products);
  assert.equal(pairs.length, 1);
});

test("кандидаты: разные бренды и категории не сравниваются", () => {
  const products = new Map<number, Product>([
    [1, product(1, { goodsTitle: "Пальто ISSA PLUS 15946" })],
    [
      2,
      product(2, {
        goodsTitle: "Пальто Другой Бренд 15946",
        producersTitle: "Другой Бренд",
      }),
    ],
    [
      3,
      product(3, {
        goodsTitle: "Куртка ISSA PLUS 15946",
        categoryId: "cat-2",
        categoryTitle: "Куртки",
      }),
    ],
  ]);
  const groups = [group(1, [1]), group(2, [2]), group(3, [3], { categoryId: "cat-2" })];
  const pairs = generateCandidatePairs(groups, products);
  assert.equal(pairs.length, 0);
});

test("кандидаты: ручные группы не участвуют", () => {
  const products = new Map<number, Product>([
    [1, product(1, { goodsTitle: "Пальто ISSA PLUS 15946" })],
    [2, product(2, { goodsTitle: "Пальто-миди ISSA PLUS 15946" })],
  ]);
  const groups = [
    group(1, [1], { manual: true }),
    group(2, [2]),
  ];
  assert.equal(generateCandidatePairs(groups, products).length, 0);
});

test("Jev: высокая вероятность автоматически объединяет группы", () => {
  const products = new Map<number, Product>([
    [1, product(1)],
    [2, product(2)],
    [3, product(3)],
  ]);
  const groups = new Map([
    [1, group(1, [1])],
    [2, group(2, [2])],
    [3, group(3, [3])],
  ]);
  const result = applyJevDecisions(
    groups,
    [
      { aId: "1", bId: "2", sameType: 0.95, sameModel: 0.97 },
      { aId: "1", bId: "3", sameType: 0.95, sameModel: 0.4 },
    ],
    products,
  );
  assert.equal(result.groups.size, 2);
  assert.equal(result.merged, 1);
  assert.deepEqual(result.groups.get(1)?.productIds, [1, 2]);
  assert.equal(result.suggestions.length, 0);
});

test("Jev: средняя вероятность даёт предложение, но не меняет группы", () => {
  const products = new Map<number, Product>([
    [1, product(1)],
    [2, product(2)],
  ]);
  const groups = new Map([
    [1, group(1, [1])],
    [2, group(2, [2])],
  ]);
  const result = applyJevDecisions(
    groups,
    [{ aId: "1", bId: "2", sameType: 0.9, sameModel: 0.9 }],
    products,
  );
  assert.equal(result.groups.size, 2);
  assert.equal(result.merged, 0);
  assert.deepEqual(result.suggestions, [
    { aId: 1, bId: 2, sameType: 0.9, sameModel: 0.9 },
  ]);
});

test("Jev: ручная группа не объединяется и не предлагается", () => {
  const products = new Map<number, Product>([
    [1, product(1)],
    [2, product(2)],
  ]);
  const groups = new Map([
    [1, group(1, [1], { manual: true })],
    [2, group(2, [2])],
  ]);
  const result = applyJevDecisions(
    groups,
    [{ aId: "1", bId: "2", sameType: 0.99, sameModel: 0.99 }],
    products,
  );
  assert.equal(result.groups.size, 2);
  assert.equal(result.suggestions.length, 0);
});

test("Jev: запрос содержит две Noul-проверки на пару", () => {
  const products = new Map<number, Product>([
    [1, product(1)],
    [2, product(2)],
  ]);
  const groups = new Map([
    [1, group(1, [1])],
    [2, group(2, [2])],
  ]);
  const jevPair = pair(groups.get(1)!, groups.get(2)!, products);
  const body = buildJevRequestBody([jevPair], "typesafe/jev-1.14");
  assert.equal(body.model, "typesafe/jev-1.14");
  assert.ok(body.questions.pair_0_type);
  assert.ok(body.questions.pair_0_model);
});

test("Jev: разбор ответа Noul", () => {
  const products = new Map<number, Product>([
    [1, product(1)],
    [2, product(2)],
  ]);
  const groups = new Map([
    [1, group(1, [1])],
    [2, group(2, [2])],
  ]);
  const jevPair = pair(groups.get(1)!, groups.get(2)!, products);
  const results = parseJevAnswers([jevPair], {
    answers: {
      pair_0_type: { type: "noul", noul: 0.91 },
      pair_0_model: { type: "noul", noul: 0.96 },
    },
  });
  assert.deepEqual(results, [
    { aId: "1", bId: "2", sameType: 0.91, sameModel: 0.96 },
  ]);
});

test("лимит пар растёт вместе с числом групп", () => {
  assert.equal(candidateLimitFor(10), 1000);
  assert.equal(candidateLimitFor(500), 2000);
  assert.equal(candidateLimitFor(1900), 7600);
  assert.equal(candidateLimitFor(5000), 8000);
});

test("Jev отримує компактний профіль пари", () => {
  const products = new Map<number, Product>([
    [1, product(1, {
      goodsTitle: "Куртка Zara 4302207 синя",
      goodsArticle: "4302207-navyblue-XXL",
      mdg: "4302207_синій",
    })],
    [2, product(2, {
      goodsTitle: "Куртка Zara 4302207 сіра",
      goodsArticle: "4302207-stone-L",
      mdg: "4302207_сірий",
    })],
  ]);
  const groups = new Map([
    [1, group(1, [1])],
    [2, group(2, [2])],
  ]);
  const jevPair = pair(groups.get(1)!, groups.get(2)!, products);
  const body = buildJevRequestBody([jevPair], "typesafe/jev-1.14");
  const state = body.state as {
    pairs: Array<{ a: Record<string, unknown>; b: Record<string, unknown> }>;
  };
  const a = state.pairs[0].a;
  assert.equal(a.code, "4302207");
  assert.equal(a.title, "Группа 1");
  assert.equal("rawTitle" in a, false);
  assert.equal("category" in a, false);
  assert.equal("article" in a, false);
  assert.equal("articleBase" in a, false);
});
