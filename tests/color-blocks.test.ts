import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MISSING_COLOR_LABEL,
  splitProductsByColor,
} from "@/lib/category/color-blocks";
import type { Product } from "@/lib/types";

function product(id: number, color: string | null, order = id): Product {
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

test("порожній вхід дає порожній список блоків", () => {
  assert.deepEqual(splitProductsByColor([]), []);
});

test("групує за точним значенням кольору без зміни порядку", () => {
  const blocks = splitProductsByColor([
    product(1, "Чорний"),
    product(2, "Бежевий"),
    product(3, "Чорний"),
    product(4, "Бежевий"),
  ]);

  assert.deepEqual(
    blocks.map((block) => block.key),
    ["чорний", "бежевий"],
  );
  assert.deepEqual(
    blocks.map((block) => block.products.map((item) => item.id)),
    [[1, 3], [2, 4]],
  );
  assert.ok(blocks.every((block) => !block.isMissing));
});

test("різні регістр і пробіли вважаються одним кольором", () => {
  const blocks = splitProductsByColor([
    product(1, "Чорний"),
    product(2, "  чорний "),
    product(3, "ЧОРНИЙ"),
  ]);

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].label, "Чорний");
  assert.deepEqual(
    blocks[0].products.map((item) => item.id),
    [1, 2, 3],
  );
});

test("різні написання кольору залишаються різними блоками", () => {
  const blocks = splitProductsByColor([
    product(1, "Чёрный"),
    product(2, "Black"),
  ]);

  assert.deepEqual(
    blocks.map((block) => block.label),
    ["Чёрный", "Black"],
  );
});

test("товари без кольору йдуть окремим блоком у кінці", () => {
  const blocks = splitProductsByColor([
    product(1, null),
    product(2, "Сірий"),
    product(3, ""),
    product(4, "   "),
  ]);

  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].label, "Сірий");
  assert.equal(blocks[1].isMissing, true);
  assert.equal(blocks[1].label, MISSING_COLOR_LABEL);
  assert.deepEqual(
    blocks[1].products.map((item) => item.id),
    [1, 3, 4],
  );
});

test("група без кольорів дає один блок «Без кольору»", () => {
  const blocks = splitProductsByColor([product(1, null), product(2, null)]);

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].isMissing, true);
  assert.deepEqual(
    blocks[0].products.map((item) => item.id),
    [1, 2],
  );
});
