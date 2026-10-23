import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildGroupComparison,
  hasCommonEvidence,
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
      }),
    ],
    [
      3,
      product(3, {
        goodsTitle: "Куртка Zara 18738 синя 3",
        goodsArticle: "4302207-navyblue-XXL",
      }),
    ],
    [
      4,
      product(4, {
        goodsTitle: "Куртка Zara 18738 синя 4",
        goodsArticle: "4302207-navyblue-XXL",
      }),
    ],
    [
      5,
      product(5, {
        goodsTitle: "Куртка Zara 18738 сіра",
        goodsArticle: "4302207-stone-L",
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
  assert.equal(comparison.a.images.length, 3);
  assert.equal(comparison.a.sampleTitles.length, 3);
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
