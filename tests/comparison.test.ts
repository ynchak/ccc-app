import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildGroupComparison,
  hasCommonEvidence,
  uniqueColorProducts,
} from "@/lib/jev/comparison";
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
    producersTitle: "Zara",
    categoryId: "cat-1",
    categoryTitle: "Куртки",
    sellerTitle: "Продавец",
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
    title: `Група ${id}`,
    titleRaw: `Група ${id}`,
    titleKey: `група ${id}`,
    titleSource: "derived",
    categoryId: "cat-1",
    categoryTitle: "Куртки",
    productIds,
    order: id,
    ...overrides,
  };
}

test("порівняння знаходить спільну базу артикула та обмежує фото", () => {
  const products = new Map<number, Product>([
    [
      1,
      product(1, {
        goodsTitle: "Куртка Zara 18738 синя",
        goodsArticle: "4302207-navyblue-XXL",
        goodsPrice: "1299.00",
        size: "XXL",
        color: "Синій",
        imageUrls: ["a", "b", "c", "d"],
      }),
    ],
    [
      2,
      product(2, {
        goodsTitle: "Куртка Zara 18738 синя 2",
        goodsArticle: "4302207-navyblue-XXL",
        goodsPrice: "1299.00",
      }),
    ],
    [
      3,
      product(3, {
        goodsTitle: "Куртка Zara 18738 синя 3",
        goodsArticle: "4302207-navyblue-XXL",
        goodsPrice: "1299.00",
      }),
    ],
    [
      4,
      product(4, {
        goodsTitle: "Куртка Zara 18738 синя 4",
        goodsArticle: "4302207-navyblue-XXL",
        goodsPrice: "1299.00",
      }),
    ],
    [
      5,
      product(5, {
        goodsTitle: "Куртка Zara 18738 сіра",
        goodsArticle: "4302207-stone-L",
        goodsPrice: "1299.00",
        size: "L",
        color: "Сірий",
        imageUrls: ["e"],
      }),
    ],
  ]);

  const a = group(1, [1, 2, 3, 4]);
  const b = group(2, [5]);
  const comparison = buildGroupComparison(a, b, products);

  assert.deepEqual(comparison.a.articleBases, ["4302207"]);
  assert.deepEqual(comparison.b.articleBases, ["4302207"]);
  assert.deepEqual(comparison.common.brands, ["Zara"]);
  assert.deepEqual(comparison.common.articleBases, ["4302207"]);
  assert.deepEqual(comparison.common.prices, ["1299.00"]);
  assert.equal(comparison.differences.prices, false);
  assert.equal(comparison.a.products.length, 4);
  assert.equal(comparison.b.products.length, 1);
  assert.equal(comparison.a.products[0]?.price, "1299.00");
  assert.deepEqual(comparison.a.products[0]?.images, ["a", "b", "c", "d"]);
  assert.equal(comparison.differences.colors, true);
  assert.equal(comparison.differences.sizes, true);
  assert.equal(hasCommonEvidence(comparison), true);
});

test("без спільних ознак порівняння це показує", () => {
  const products = new Map<number, Product>([
    [1, product(1, { goodsArticle: "1111-red", producersTitle: "Brand A" })],
    [2, product(2, { goodsArticle: "2222-blue", producersTitle: "Brand B" })],
  ]);
  const comparison = buildGroupComparison(
    group(1, [1]),
    group(2, [2]),
    products,
  );
  assert.equal(hasCommonEvidence(comparison), false);
  assert.deepEqual(comparison.common.articleBases, []);
});

test("різні ціни груп показуються як відмінність", () => {
  const products = new Map<number, Product>([
    [1, product(1, { goodsPrice: "1299.00" })],
    [2, product(2, { goodsPrice: "1399.00" })],
  ]);
  const comparison = buildGroupComparison(
    group(1, [1]),
    group(2, [2]),
    products,
  );

  assert.deepEqual(comparison.a.prices, ["1299.00"]);
  assert.deepEqual(comparison.b.prices, ["1399.00"]);
  assert.deepEqual(comparison.common.prices, []);
  assert.equal(comparison.differences.prices, true);
});

test("ціни в різному форматі вважаються однаковими", () => {
  const products = new Map<number, Product>([
    [1, product(1, { goodsPrice: "1299.00" })],
    [2, product(2, { goodsPrice: "1299" })],
  ]);
  const comparison = buildGroupComparison(
    group(1, [1]),
    group(2, [2]),
    products,
  );

  assert.deepEqual(comparison.common.prices, ["1299"]);
  assert.equal(comparison.differences.prices, false);
});

test("без цін різниця не показується", () => {
  const products = new Map<number, Product>([
    [1, product(1)],
    [2, product(2)],
  ]);
  const comparison = buildGroupComparison(
    group(1, [1]),
    group(2, [2]),
    products,
  );

  assert.deepEqual(comparison.a.prices, []);
  assert.deepEqual(comparison.b.prices, []);
  assert.deepEqual(comparison.common.prices, []);
  assert.equal(comparison.differences.prices, false);
});

test("для порівняння береться один товар на кожен колір", () => {
  const whiteTitle = "Білий лонгслив";
  const products = new Map<number, Product>([
    [1, product(1, { goodsTitle: whiteTitle, color: "Білий", imageUrls: ["a"], goodsPrice: "100" })],
    [2, product(2, { goodsTitle: whiteTitle, color: "Білий", goodsPrice: "100" })],
    [3, product(3, { goodsTitle: whiteTitle, color: "Білий", imageUrls: ["c"], goodsPrice: "100" })],
    [4, product(4, { goodsTitle: "Чорний лонгслив", color: "Чорний", imageUrls: ["d"], goodsPrice: "200" })],
    [5, product(5, { goodsTitle: "Товар без кольору", imageUrls: ["e"] })],
    [6, product(6, { goodsTitle: "Товар без кольору", imageUrls: ["f"] })],
    [7, product(7, { goodsTitle: "Інший товар", imageUrls: ["g"] })],
    [8, product(8, { goodsTitle: "Друга група" })],
  ]);

  const comparison = buildGroupComparison(
    group(1, [1, 2, 3, 4, 5, 6, 7]),
    group(2, [8]),
    products,
  );
  const preview = uniqueColorProducts(comparison.a.products);

  assert.equal(preview.length, 4);
  assert.equal(preview.filter((item) => item.color === "Білий").length, 1);
  assert.equal(preview.filter((item) => item.color === "Чорний").length, 1);
  assert.equal(preview.filter((item) => !item.color).length, 2);
  assert.equal(
    preview.find((item) => item.color === "Білий")?.id,
    1,
  );
});
