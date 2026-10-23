import assert from "node:assert/strict";
import { test } from "node:test";

import { parseCsv } from "@/lib/csv/parse";
import {
  clusterByPhotos,
  normalizeTitle,
  toGroups,
} from "@/lib/grouping/cluster";
import { mergeByTitle } from "@/lib/grouping/merge";
import type { ParsedProduct } from "@/lib/types";
import {
  SYNTHETIC_CSV,
  SYNTHETIC_GROUP_COUNT,
  SYNTHETIC_PRODUCT_COUNT,
  SYNTHETIC_SINGLE_COUNT,
} from "./fixtures";

const load = () => {
  const { products, columnMap } = parseCsv(SYNTHETIC_CSV);
  const clusters = clusterByPhotos(products);
  const grouped = toGroups(clusters, products);
  const { groups, mergedCount } = mergeByTitle(grouped, products);
  return { products, columnMap, groups, mergedCount };
};

/** Минимальный товар для синтетических тестов. */
function product(
  overrides: Partial<ParsedProduct> & Pick<ParsedProduct, "goodsId" | "order">,
): ParsedProduct {
  return {
    goodsTitle: `Товар ${overrides.goodsId}`,
    goodsArticle: "",
    producersTitle: "",
    categoryId: "cat-1",
    categoryTitle: "Категория",
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

test("парсер читает все строки файла", () => {
  const { products } = load();
  assert.equal(products.length, SYNTHETIC_PRODUCT_COUNT);
  assert.equal(products.filter((p) => !p.size).length, 0);
  assert.equal(products.filter((p) => !p.imageUrls.length).length, 0);
  assert.equal(products.filter((p) => !p.goodsTitle).length, 0);
});

test("EAN и рост отсутствуют в файле — значение null, не ошибка", () => {
  const { products, columnMap } = load();
  assert.equal(products.filter((p) => p.ean !== null).length, 0);
  assert.equal(products.filter((p) => p.height !== null).length, 0);
  const missing = columnMap.filter((m) => m.missing).map((m) => m.field);
  assert.ok(missing.includes("ean"));
  assert.ok(missing.includes("height"));
});

test("колонки с разными ID одного атрибута разводятся правильно", () => {
  const { products } = load();
  // Размер: одежда — буквенный, обувь — числовой.
  const clothing = products.filter((p) => p.categoryTitle === "Одежда");
  const shoes = products.filter((p) => p.categoryTitle === "Обувь");
  assert.ok(clothing.every((p) => /^[A-Z]/.test(p.size ?? "")));
  assert.ok(shoes.every((p) => /^\d/.test(p.size ?? "")));
  assert.ok(products.every((p) => p.size !== null));
});

test("фото-группировка: синтетические кластеры и группы", () => {
  const { products } = parseCsv(SYNTHETIC_CSV);
  const clusters = clusterByPhotos(products);
  assert.equal(clusters.length, SYNTHETIC_GROUP_COUNT);
  assert.equal(
    clusters.filter((c) => c.memberIndexes.length === 1).length,
    SYNTHETIC_SINGLE_COUNT,
  );

  const { groups, mergedCount } = mergeByTitle(
    toGroups(clusters, products),
    products,
  );
  assert.equal(groups.length, SYNTHETIC_GROUP_COUNT);
  assert.equal(mergedCount, 0);
  assert.equal(
    groups.filter((g) => g.memberIndexes.length === 1).length,
    SYNTHETIC_SINGLE_COUNT,
  );
});

test("общая ссылка на фото объединяет товары внутри категории", () => {
  const products = [
    product({
      goodsId: "1",
      order: 0,
      imageUrls: ["https://img/1.jpg", "https://img/2.jpg"],
    }),
    product({
      goodsId: "2",
      order: 1,
      imageUrls: ["https://img/2.jpg", "https://img/3.jpg"],
    }),
    product({
      goodsId: "3",
      order: 2,
      imageUrls: ["https://img/other.jpg"],
    }),
  ];

  const clusters = clusterByPhotos(products);
  assert.equal(clusters.length, 2);
  assert.deepEqual(clusters[0].memberIndexes, [0, 1]);
  assert.deepEqual(clusters[1].memberIndexes, [2]);
});

test("одинаковые фото не объединяют товары разных категорий", () => {
  const products = [
    product({
      goodsId: "1",
      order: 0,
      categoryId: "a",
      imageUrls: ["https://img/1.jpg"],
    }),
    product({
      goodsId: "2",
      order: 1,
      categoryId: "b",
      imageUrls: ["https://img/1.jpg"],
    }),
  ];

  const clusters = clusterByPhotos(products);
  assert.equal(clusters.length, 2);
});

test("название группы — исходный заголовок первого товара", () => {
  const { products, groups } = load();
  for (const group of groups) {
    const first = products[group.memberIndexes[0]];
    assert.equal(group.title, first.goodsTitle);
    assert.equal(group.titleRaw, first.goodsTitle);
  }
});

test("слияние по названию работает только внутри категории", () => {
  const products = [
    product({ goodsId: "1", order: 0, goodsTitle: "Одинаковое" }),
    product({
      goodsId: "2",
      order: 1,
      goodsTitle: "Одинаковое",
      categoryId: "cat-2",
      categoryTitle: "Другая",
    }),
    product({
      goodsId: "3",
      order: 2,
      goodsTitle: "Одинаковое",
      categoryId: "cat-1",
    }),
  ];

  const groups = [
    {
      memberIndexes: [0],
      title: "Одинаковое",
      titleRaw: "Одинаковое",
      titleKey: normalizeTitle("Одинаковое"),
      categoryId: "cat-1",
      categoryTitle: "Категория",
    },
    {
      memberIndexes: [1],
      title: "Одинаковое",
      titleRaw: "Одинаковое",
      titleKey: normalizeTitle("Одинаковое"),
      categoryId: "cat-2",
      categoryTitle: "Другая",
    },
    {
      memberIndexes: [2],
      title: "Одинаковое",
      titleRaw: "Одинаковое",
      titleKey: normalizeTitle("Одинаковое"),
      categoryId: "cat-1",
      categoryTitle: "Категория",
    },
  ];

  const result = mergeByTitle(groups, products);
  assert.equal(result.groups.length, 2);
  assert.equal(result.mergedCount, 1);
  assert.deepEqual(
    result.groups.find((g) => g.categoryId === "cat-1")?.memberIndexes,
    [0, 2],
  );
});

test("группы не пересекают категории", () => {
  const { products, groups } = load();
  for (const group of groups) {
    const categories = new Set(
      group.memberIndexes.map((i) => products[i].categoryId),
    );
    assert.equal(
      categories.size,
      1,
      `группа ${group.title} имеет несколько категорий`,
    );
  }
});

test("названия групп уникальны внутри категории", () => {
  const { groups } = load();
  const keys = groups.map((g) => `${g.categoryId}\u0000${g.titleKey}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(groups.every((g) => g.title.length > 0));
});

test("парсер выдерживает файл только с goods_id", () => {
  const { products, skippedRows } = parseCsv("goods_id\n123\n");
  assert.equal(skippedRows, 0);
  assert.equal(products.length, 1);
  assert.equal(products[0].goodsId, "123");
  assert.equal(products[0].goodsTitle, "123");
  assert.deepEqual(products[0].imageUrls, []);
});

test("BOM в начале файла не мешает найти колонки", () => {
  const { products, columnMap } = parseCsv(
    "\uFEFFgoods_id,goods_title\n1,Тестовый товар\n",
  );
  assert.equal(products.length, 1);
  assert.equal(products[0].goodsTitle, "Тестовый товар");
  assert.equal(columnMap.find((m) => m.field === "goodsId")?.missing, false);
});
