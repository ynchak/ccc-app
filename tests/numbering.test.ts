import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeGroupNumbers } from "@/lib/grouping/numbering";

const group = (
  id: number,
  categoryTitle: string,
  title: string,
  number?: number,
) => ({ id, categoryTitle, title, number });

test("старым группам без номеров номера назначаются по категории и названию", () => {
  const groups = [
    group(1, "Обувь", "Кроссовки B"),
    group(2, "Одежда", "Худи B"),
    group(3, "Обувь", "Кроссовки A"),
    group(4, "Одежда", "Худи A"),
  ];

  const result = normalizeGroupNumbers(groups);
  assert.deepEqual(
    result.groups.map((item) => [item.id, item.number]),
    [
      [1, 2],
      [2, 4],
      [3, 1],
      [4, 3],
    ],
  );
  assert.equal(result.changed.length, 4);
});

test("существующие номера сохраняются, новые получают следующие", () => {
  const groups = [
    group(1, "Одежда", "Худи", 5),
    group(2, "Одежда", "Футболка"),
    group(3, "Обувь", "Кроссовки", 2),
    group(4, "Обувь", "Ботинки"),
  ];

  const result = normalizeGroupNumbers(groups);
  assert.deepEqual(
    result.groups.map((item) => [item.id, item.number]),
    [
      [1, 5],
      [2, 7],
      [3, 2],
      [4, 6],
    ],
  );
});

test("дубли номеров исправляются, первый номер остаётся", () => {
  const groups = [
    group(1, "Одежда", "Худи", 1),
    group(2, "Одежда", "Футболка", 1),
  ];

  const result = normalizeGroupNumbers(groups);
  assert.deepEqual(
    result.groups.map((item) => [item.id, item.number]),
    [
      [1, 1],
      [2, 2],
    ],
  );
});

test("если все номера корректны, массив не меняется", () => {
  const groups = [group(1, "Одежда", "Худи", 1)];
  const result = normalizeGroupNumbers(groups);
  assert.equal(result.groups, groups);
  assert.deepEqual(result.changed, []);
});
