import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_PAGE_SIZE,
  isPageSize,
  paginate,
} from "@/lib/pagination";

const items = Array.from({ length: 123 }, (_, index) => index + 1);

test("по умолчанию 50 групп на странице", () => {
  assert.equal(DEFAULT_PAGE_SIZE, 50);
});

test("пагинация разбивает список на страницы", () => {
  const first = paginate(items, 1, 50);
  assert.equal(first.items.length, 50);
  assert.equal(first.items[0], 1);
  assert.equal(first.items[49], 50);
  assert.equal(first.totalPages, 3);
  assert.equal(first.start, 1);
  assert.equal(first.end, 50);

  const middle = paginate(items, 2, 50);
  assert.equal(middle.items.length, 50);
  assert.equal(middle.items[0], 51);
  assert.equal(middle.start, 51);
  assert.equal(middle.end, 100);

  const last = paginate(items, 3, 50);
  assert.equal(last.items.length, 23);
  assert.equal(last.items[0], 101);
  assert.equal(last.start, 101);
  assert.equal(last.end, 123);
});

test("номер страницы ограничивается допустимым диапазоном", () => {
  assert.equal(paginate(items, 0, 50).page, 1);
  assert.equal(paginate(items, -3, 50).page, 1);
  assert.equal(paginate(items, 999, 50).page, 3);
  assert.equal(paginate(items, Number.NaN, 50).page, 1);
});

test("размер страницы можно изменить", () => {
  const page = paginate(items, 1, 25);
  assert.equal(page.items.length, 25);
  assert.equal(page.totalPages, 5);

  const large = paginate(items, 1, 200);
  assert.equal(large.items.length, 123);
  assert.equal(large.totalPages, 1);
});

test("пустой список не ломает пагинацию", () => {
  const page = paginate([], 4, 50);
  assert.deepEqual(page.items, []);
  assert.equal(page.page, 1);
  assert.equal(page.totalPages, 1);
  assert.equal(page.start, 0);
  assert.equal(page.end, 0);
});

test("isPageSize пропускает только допустимые значения", () => {
  assert.equal(isPageSize(25), true);
  assert.equal(isPageSize(50), true);
  assert.equal(isPageSize(100), true);
  assert.equal(isPageSize(200), true);
  assert.equal(isPageSize(75), false);
  assert.equal(isPageSize("50"), false);
  assert.equal(isPageSize(undefined), false);
});
