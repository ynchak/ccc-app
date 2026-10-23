import assert from "node:assert/strict";
import { test } from "node:test";

import { mergeGroupsByArticleCode } from "@/lib/jev/code-merge";
import type { Group, Product } from "@/lib/types";

function product(
  id: number,
  article: string,
  overrides: Partial<Product> = {},
): Product {
  return {
    id,
    datasetId: 1,
    order: id,
    goodsId: String(id),
    goodsTitle: `Товар ${id}`,
    goodsArticle: article,
    producersTitle: "",
    categoryId: "cat",
    categoryTitle: "Категорія",
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
    title: `Група ${id}`,
    titleRaw: `Група ${id}`,
    titleKey: `група ${id}`,
    titleSource: "derived",
    categoryId: "cat",
    categoryTitle: "Категорія",
    productIds,
    order: id,
    ...overrides,
  };
}

test("групи з однаковим articleBase та відсутнім брендом об’єднуються", () => {
  const products = new Map<number, Product>([
    [1, product(1, "4302207-navyblue-XXL")],
    [2, product(2, "4302207-stone-L")],
  ]);
  const result = mergeGroupsByArticleCode(
    new Map([
      [1, group(1, [1])],
      [2, group(2, [2])],
    ]),
    products,
  );
  assert.equal(result.merged, 1);
  assert.equal(result.groups.size, 1);
  assert.deepEqual(result.groups.get(1)?.productIds, [1, 2]);
});

test("різний або відсутній бренд не дає автоматичного об’єднання", () => {
  const products = new Map<number, Product>([
    [1, product(1, "4302207-a", { producersTitle: "Zara" })],
    [2, product(2, "4302207-b", { producersTitle: "" })],
    [3, product(3, "4302207-c", { producersTitle: "Інший" })],
  ]);
  const result = mergeGroupsByArticleCode(
    new Map([
      [1, group(1, [1])],
      [2, group(2, [2])],
      [3, group(3, [3])],
    ]),
    products,
  );
  assert.equal(result.merged, 0);
  assert.equal(result.groups.size, 3);
});

test("група з кількома articleBase не об’єднується", () => {
  const products = new Map<number, Product>([
    [1, product(1, "4302207-a")],
    [2, product(2, "4302208-b")],
    [3, product(3, "4302207-c")],
  ]);
  const result = mergeGroupsByArticleCode(
    new Map([
      [1, group(1, [1, 2])],
      [2, group(2, [3])],
    ]),
    products,
  );
  assert.equal(result.merged, 0);
});

test("ручні групи не об’єднуються автоматично", () => {
  const products = new Map<number, Product>([
    [1, product(1, "4302207-a")],
    [2, product(2, "4302207-b")],
  ]);
  const result = mergeGroupsByArticleCode(
    new Map([
      [1, group(1, [1], { manual: true })],
      [2, group(2, [2])],
    ]),
    products,
  );
  assert.equal(result.merged, 0);
});
