import assert from "node:assert/strict";
import { test } from "node:test";

import { buildExportRows } from "@/lib/export/rows";
import type { Group, Product } from "@/lib/types";

const product = (overrides: Partial<Product>): Product => ({
  id: 1,
  datasetId: 1,
  order: 0,
  goodsId: "100",
  goodsTitle: "Товар",
  goodsArticle: "",
  producersTitle: "",
  categoryId: "cat",
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
});

const group = (overrides: Partial<Group>): Group => ({
  id: 10,
  datasetId: 1,
  number: 1,
  title: "Группа",
  titleRaw: "Группа",
  titleKey: "группа",
  titleSource: "derived",
  categoryId: "cat",
  categoryTitle: "Категория",
  productIds: [],
  order: 0,
  ...overrides,
});

test("экспорт сортирует строки по группе и подставляет группу", () => {
  const products = [
    product({ id: 1, order: 1, goodsId: "2", goodsTitle: "Второй" }),
    product({ id: 2, order: 0, goodsId: "1", goodsTitle: "Первый" }),
  ];
  const groups = [
    group({ id: 10, title: "Группа A", productIds: [1] }),
    group({ id: 11, title: "Группа B", productIds: [2] }),
  ];
  const productToGroup = new Map([
    [1, 10],
    [2, 11],
  ]);

  const rows = buildExportRows(products, groups, productToGroup);
  assert.deepEqual(rows, [
    {
      id: "2",
      goodsTitle: "Второй",
      categoryTitle: "Категория",
      groupTitle: "Группа A",
      suggestedColor: "",
    },
    {
      id: "1",
      goodsTitle: "Первый",
      categoryTitle: "Категория",
      groupTitle: "Группа B",
      suggestedColor: "",
    },
  ]);
});

test("внутри группы сохраняется исходный порядок, без группы — в конце", () => {
  const products = [
    product({ id: 1, order: 2, goodsId: "3", goodsTitle: "Третий" }),
    product({ id: 2, order: 0, goodsId: "1", goodsTitle: "Первый" }),
    product({ id: 3, order: 1, goodsId: "2", goodsTitle: "Второй" }),
    product({ id: 4, order: 3, goodsId: "4", goodsTitle: "Без группы" }),
  ];
  const groups = [
    group({ id: 10, title: "Группа A", productIds: [1, 2] }),
    group({ id: 11, title: "Группа B", productIds: [3] }),
  ];
  const productToGroup = new Map([
    [1, 10],
    [2, 10],
    [3, 11],
  ]);

  const rows = buildExportRows(products, groups, productToGroup);
  assert.deepEqual(
    rows.map((row) => row.id),
    ["1", "3", "2", "4"],
  );
});

test("товар без группы экспортируется с пустой группой", () => {
  const rows = buildExportRows(
    [product({ id: 1, order: 0 })],
    [],
    new Map(),
  );
  assert.equal(rows[0].groupTitle, "");
});

test("в экспорт попадает только предложенный сервисом цвет", () => {
  const rows = buildExportRows(
    [
      product({
        id: 1,
        order: 0,
        color: "Бежевий",
        colorSource: "suggested",
      }),
      product({ id: 2, order: 1, color: "Чорний" }),
    ],
    [],
    new Map(),
  );
  assert.deepEqual(
    rows.map((row) => row.suggestedColor),
    ["Бежевий", ""],
  );
});
