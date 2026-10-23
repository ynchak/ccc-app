import assert from "node:assert/strict";
import { test } from "node:test";

import { sortGroupProducts } from "@/lib/grouping/product-sort";
import type { Product } from "@/lib/types";

function product(
  id: number,
  color: string | null,
  order = id,
): Product {
  return {
    id,
    datasetId: 1,
    order,
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
  };
}

test("товари сортуються за кольором, порожній колір — у кінці", () => {
  const products = [
    product(1, "Чорний"),
    product(2, null),
    product(3, "Бежевий"),
    product(4, "Сірий"),
  ];
  assert.deepEqual(
    sortGroupProducts(products, "color").map((item) => item.id),
    [3, 4, 1, 2],
  );
});

test("усередині кольору зберігається вихідний порядок", () => {
  const products = [
    product(1, "Сірий", 30),
    product(2, "Сірий", 10),
    product(3, "Сірий", 20),
  ];
  assert.deepEqual(
    sortGroupProducts(products, "color").map((item) => item.id),
    [2, 3, 1],
  );
});

test("режим за порядком повертає вихідний порядок", () => {
  const products = [
    product(1, "Сірий", 30),
    product(2, "Чорний", 10),
    product(3, "Бежевий", 20),
  ];
  assert.deepEqual(
    sortGroupProducts(products, "order").map((item) => item.id),
    [2, 3, 1],
  );
});
