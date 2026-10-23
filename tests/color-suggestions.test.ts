import assert from "node:assert/strict";
import { test } from "node:test";

import { applySuggestedColors } from "@/lib/llm/color-suggestions";
import type { Group, Product } from "@/lib/types";

function product(
  id: number,
  color: string | null,
  overrides: Partial<Product> = {},
): Product {
  return {
    id,
    datasetId: 1,
    order: id,
    goodsId: String(id),
    goodsTitle: `Товар ${id}`,
    goodsArticle: "",
    producersTitle: "",
    categoryId: "cat",
    categoryTitle: "Категорія",
    sellerTitle: "",
    gomerSyncSourceId: "",
    mdg: null,
    description: null,
    size: null,
    color,
    height: null,
    ean: null,
    imageUrls: [],
    ...overrides,
  };
}

function group(id: number, productIds: number[]): Group {
  return {
    id,
    datasetId: 1,
    number: id,
    title: `Група ${id}`,
    titleRaw: `Група ${id}`,
    titleKey: `група ${id}`,
    titleSource: "derived",
    categoryId: "cat",
    categoryTitle: "Категорія",
    productIds,
    order: id,
  };
}

test("єдиний вихідний колір переноситься на товари без кольору", () => {
  const products = new Map<number, Product>([
    [1, product(1, "Бежевий")],
    [2, product(2, null)],
    [3, product(3, "Бежевий")],
  ]);
  const result = applySuggestedColors(
    [group(1, [1, 2, 3])],
    products,
    new Map(),
  );

  assert.equal(result.count, 1);
  assert.equal(result.products.get(2)?.color, "Бежевий");
  assert.equal(result.products.get(2)?.colorSource, "suggested");
  assert.equal(result.products.get(1)?.colorSource, undefined);
});

test("колір з назви використовується, якщо поле порожнє", () => {
  const products = new Map<number, Product>([
    [1, product(1, null)],
    [2, product(2, null)],
  ]);
  const result = applySuggestedColors(
    [group(1, [1, 2])],
    products,
    new Map([[1, "Синій"]]),
  );

  assert.equal(result.count, 2);
  assert.equal(result.products.get(1)?.color, "Синій");
  assert.equal(result.products.get(2)?.color, "Синій");
});

test("кілька різних вихідних кольорів не змінюються", () => {
  const products = new Map<number, Product>([
    [1, product(1, "Бежевий")],
    [2, product(2, "Чорний")],
    [3, product(3, null)],
  ]);
  const result = applySuggestedColors(
    [group(1, [1, 2, 3])],
    products,
    new Map([[1, "Синій"]]),
  );

  assert.equal(result.count, 0);
  assert.equal(result.products.get(3)?.color, null);
});

test("без кольору в полі й назві нічого не додається", () => {
  const products = new Map<number, Product>([
    [1, product(1, null)],
    [2, product(2, null)],
  ]);
  const result = applySuggestedColors(
    [group(1, [1, 2])],
    products,
    new Map([[1, undefined]]),
  );

  assert.equal(result.count, 0);
  assert.deepEqual(result.changed, []);
});
