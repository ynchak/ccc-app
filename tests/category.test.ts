import assert from "node:assert/strict";
import { test } from "node:test";

import { buildModelLinks } from "@/lib/category/links";
import {
  ATTENTION_SECTION_ID,
  effectiveCategoryId,
} from "@/lib/store/category-store";
import { buildCategoryChangeRows } from "@/lib/export/category-rows";
import { buildFinalExportRows } from "@/lib/export/final-rows";
import { clusterByPhotos } from "@/lib/grouping/cluster";
import type {
  CategoryCluster,
  Group,
  ParsedProduct,
  Product,
} from "@/lib/types";

function parsed(
  overrides: Partial<ParsedProduct> & Pick<ParsedProduct, "goodsId" | "order">,
): ParsedProduct {
  return {
    goodsTitle: `Товар ${overrides.goodsId}`,
    goodsArticle: "",
    producersTitle: "",
    categoryId: "cat-a",
    categoryTitle: "Категория A",
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

function product(
  overrides: Partial<Product> & Pick<Product, "id" | "order">,
): Product {
  return {
    datasetId: 1,
    goodsId: String(overrides.id),
    goodsTitle: `Товар ${overrides.id}`,
    goodsArticle: "",
    producersTitle: "",
    categoryId: "cat-a",
    categoryTitle: "Категория A",
    originalCategoryId: "cat-a",
    originalCategoryTitle: "Категория A",
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

function cluster(
  overrides: Partial<CategoryCluster> & Pick<CategoryCluster, "id">,
): CategoryCluster {
  return {
    datasetId: 1,
    number: overrides.id,
    title: `Кластер ${overrides.id}`,
    order: overrides.id,
    productIds: [],
    targetCategoryId: null,
    targetCategoryTitle: null,
    ...overrides,
  };
}

test("по умолчанию одинаковые фото не объединяют разные категории", () => {
  const products = [
    parsed({ goodsId: "1", order: 0, imageUrls: ["a"] }),
    parsed({
      goodsId: "2",
      order: 1,
      categoryId: "cat-b",
      categoryTitle: "Категория B",
      imageUrls: ["a"],
    }),
  ];
  assert.equal(clusterByPhotos(products).length, 2);
});

test("в потоке категорий одинаковые фото объединяются между категориями", () => {
  const products = [
    parsed({ goodsId: "1", order: 0, imageUrls: ["a"] }),
    parsed({
      goodsId: "2",
      order: 1,
      categoryId: "cat-b",
      categoryTitle: "Категория B",
      imageUrls: ["a"],
    }),
  ];
  const clusters = clusterByPhotos(products, { acrossCategories: true });
  assert.equal(clusters.length, 1);
  assert.deepEqual(clusters[0].memberIndexes, [0, 1]);
});

test("экспорт категорий берёт только изменённые товары", () => {
  const products = [
    product({ id: 1, order: 0, goodsId: "10" }),
    product({
      id: 2,
      order: 1,
      goodsId: "20",
      categoryId: "cat-b",
      categoryTitle: "Категория B",
      originalCategoryId: "cat-b",
      originalCategoryTitle: "Категория B",
    }),
    product({ id: 3, order: 2, goodsId: "30" }),
  ];
  const clusters = [
    cluster({
      id: 1,
      productIds: [1, 2],
      targetCategoryId: "cat-b",
      targetCategoryTitle: "Категория B",
    }),
    cluster({ id: 2, productIds: [3] }),
  ];
  assert.deepEqual(buildCategoryChangeRows(products, clusters), [
    {
      id: "10",
      categoryTitle: "Категория B",
      categoryId: "cat-b",
    },
  ]);
});

test("финальный экспорт содержит категорию и группу", () => {
  const products = [
    product({ id: 1, order: 1, goodsId: "2", goodsTitle: "Второй" }),
    product({ id: 2, order: 0, goodsId: "1", goodsTitle: "Первый" }),
  ];
  const groups: Group[] = [
    {
      id: 10,
      datasetId: 1,
      number: 1,
      title: "Группа A",
      titleRaw: "Группа A",
      titleKey: "группа a",
      titleSource: "derived",
      categoryId: "cat-a",
      categoryTitle: "Категория A",
      productIds: [1],
      order: 0,
    },
  ];
  assert.deepEqual(buildFinalExportRows(products, groups, new Map([[1, 10]])), [
    {
      id: "2",
      categoryTitle: "Категория A",
      categoryId: "cat-a",
      groupTitle: "Группа A",
    },
    {
      id: "1",
      categoryTitle: "Категория A",
      categoryId: "cat-a",
      groupTitle: "",
    },
  ]);
});

test("группа попадает в категорию, а смешанная — в секцию внимания", () => {
  const products = new Map<number, Product>([
    [1, product({ id: 1, order: 0, categoryId: "cat-a" })],
    [
      2,
      product({
        id: 2,
        order: 1,
        categoryId: "cat-b",
        originalCategoryId: "cat-b",
        originalCategoryTitle: "Категория B",
      }),
    ],
  ]);
  const mixed = cluster({ id: 1, productIds: [1, 2] });
  assert.equal(
    effectiveCategoryId(mixed, products),
    ATTENTION_SECTION_ID,
  );

  const moved = {
    ...mixed,
    targetCategoryId: "cat-b",
    targetCategoryTitle: "Категория B",
  };
  assert.equal(effectiveCategoryId(moved, products), "cat-b");
});

test("общий артикул показывает кластеры как возможную одну модель", () => {
  const products = new Map<number, Product>([
    [
      1,
      product({ id: 1, order: 0, goodsArticle: "ABC-123", goodsTitle: "Модель" }),
    ],
    [
      2,
      product({
        id: 2,
        order: 1,
        goodsArticle: "ABC-123",
        goodsTitle: "Модель",
        categoryId: "cat-b",
        categoryTitle: "Категория B",
        originalCategoryId: "cat-b",
        originalCategoryTitle: "Категория B",
      }),
    ],
  ]);
  const clusters = [
    cluster({ id: 1, productIds: [1] }),
    cluster({ id: 2, productIds: [2] }),
  ];
  const links = buildModelLinks(clusters, products);
  assert.equal(links.get(1)?.[0]?.clusterId, 2);
  assert.equal(links.get(1)?.[0]?.kind, "article");
  assert.equal(links.get(2)?.[0]?.clusterId, 1);
});
