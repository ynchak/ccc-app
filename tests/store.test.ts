import "fake-indexeddb/auto";

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Group } from "@/lib/types";
import {
  SYNTHETIC_CSV,
  SYNTHETIC_GROUP_COUNT,
  SYNTHETIC_PRODUCT_COUNT,
} from "./fixtures";

function productsInGroups(groups: Iterable<{ productIds: number[] }>): number {
  let count = 0;
  for (const group of groups) count += group.productIds.length;
  return count;
}

test("store: импорт, переименование, перенос, удаление и undo", async () => {
  const { useAppStore } = await import("@/lib/store/app-store");
  const text = SYNTHETIC_CSV;

  await useAppStore.getState().importFile("test-data.csv", text);
  let state = useAppStore.getState();

  assert.equal(state.products.size, SYNTHETIC_PRODUCT_COUNT);
  assert.equal(state.groups.size, SYNTHETIC_GROUP_COUNT);
  assert.equal(
    productsInGroups(state.groups.values()),
    SYNTHETIC_PRODUCT_COUNT,
  );

  // Каждая группа получила сырой заголовок первого товара.
  for (const group of state.groups.values()) {
    const firstId = group.productIds[0];
    const first = state.products.get(firstId);
    assert.ok(first);
    assert.equal(group.title, first.goodsTitle);
  }

  // Порядок при импорте: категория, затем название группы.
  const importedOrder = state.orderedGroupIds.map((id) => {
    const group = state.groups.get(id);
    assert.ok(group);
    return group;
  });
  for (let i = 1; i < importedOrder.length; i++) {
    const previous = importedOrder[i - 1];
    const current = importedOrder[i];
    const categoryOrder = previous.categoryTitle.localeCompare(
      current.categoryTitle,
      "uk",
    );
    assert.ok(
      categoryOrder < 0 ||
        (categoryOrder === 0 &&
          previous.title.localeCompare(current.title, "uk") <= 0),
      `нарушен порядок: ${previous.title} → ${current.title}`,
    );
  }

  // Номера групп идут подряд в порядке отображения и уникальны.
  assert.deepEqual(
    importedOrder.map((group) => group.number),
    importedOrder.map((_, index) => index + 1),
  );

  // Находим две группы одной категории для проверки слияния.
  const byCategory = new Map<string, Group[]>();
  for (const group of state.groups.values()) {
    const list = byCategory.get(group.categoryId) ?? [];
    list.push(group);
    byCategory.set(group.categoryId, list);
  }
  const pair = [...byCategory.values()].find((list) => list.length >= 2);
  assert.ok(pair, "в файле должна быть категория с двумя группами");

  const [firstGroup, secondGroup] = pair;
  const beforeRenameCount = state.groups.size;

  // Переименование в уникальное название не двигает группу в списке.
  const indexBeforeRename = state.orderedGroupIds.indexOf(firstGroup.id);
  const numberBeforeRename = firstGroup.number;
  assert.ok(indexBeforeRename >= 0);
  const uniqueTitle = `ЯЯЯ Уникальная группа ${firstGroup.id}`;
  assert.equal(
    await useAppStore.getState().renameGroup(firstGroup.id, uniqueTitle),
    true,
  );
  state = useAppStore.getState();
  assert.equal(
    state.orderedGroupIds.indexOf(firstGroup.id),
    indexBeforeRename,
  );
  assert.equal(state.groups.get(firstGroup.id)?.number, numberBeforeRename);
  assert.equal(await useAppStore.getState().undo(), true);
  state = useAppStore.getState();

  const renamed = await useAppStore
    .getState()
    .renameGroup(firstGroup.id, secondGroup.title);
  assert.equal(renamed, true);
  state = useAppStore.getState();
  assert.equal(state.groups.size, beforeRenameCount - 1);
  assert.equal(
    productsInGroups(state.groups.values()),
    SYNTHETIC_PRODUCT_COUNT,
  );

  // Отменяем переименование.
  assert.equal(await useAppStore.getState().undo(), true);
  state = useAppStore.getState();
  assert.equal(state.groups.size, beforeRenameCount);

  // Перенос товара в другую группу той же категории и отмена.
  const movePair = [...byCategory.values()].find(
    (list) =>
      list.length >= 2 &&
      list[0].productIds.length + list[1].productIds.length > 2,
  );
  assert.ok(movePair, "нужны две группы одной категории");
  const source = useAppStore
    .getState()
    .groups.get(movePair[0].id) as { id: number; productIds: number[] };
  const target = useAppStore
    .getState()
    .groups.get(movePair[1].id) as { id: number; productIds: number[] };
  const movedProductId = source.productIds[0];

  assert.equal(
    await useAppStore.getState().moveProduct(movedProductId, target.id),
    true,
  );
  state = useAppStore.getState();
  assert.equal(state.productToGroup.get(movedProductId), target.id);
  assert.equal(
    productsInGroups(state.groups.values()),
    SYNTHETIC_PRODUCT_COUNT,
  );
  assert.equal(await useAppStore.getState().undo(), true);
  state = useAppStore.getState();
  assert.notEqual(state.productToGroup.get(movedProductId), target.id);

  // Товар нельзя перенести в группу другой категории.
  const categoryIds = [...new Set([...state.groups.values()].map((g) => g.categoryId))];
  if (categoryIds.length >= 2) {
    const groupA = [...state.groups.values()].find(
      (g) => g.categoryId === categoryIds[0] && g.productIds.length > 0,
    );
    const groupB = [...state.groups.values()].find(
      (g) => g.categoryId === categoryIds[1],
    );
    assert.ok(groupA && groupB);
    assert.equal(
      await useAppStore
        .getState()
        .moveProduct(groupA.productIds[0], groupB.id),
      false,
    );
  }

  // Создание новой группы из товара: товар отделяется от старой группы.
  const splitSource = [...state.groups.values()].find(
    (group) => group.productIds.length > 1,
  );
  assert.ok(splitSource);
  const splitProductId = splitSource.productIds[0];
  const splitProduct = state.products.get(splitProductId);
  assert.ok(splitProduct);

  const maxNumberBeforeCreate = Math.max(
    ...[...state.groups.values()].map((group) => group.number),
  );
  const newGroupId = await useAppStore
    .getState()
    .createGroupFromProducts([splitProductId]);
  assert.ok(newGroupId !== null);
  state = useAppStore.getState();

  const newGroup = state.groups.get(newGroupId);
  const oldGroup = state.groups.get(splitSource.id);
  assert.ok(newGroup && oldGroup);
  assert.deepEqual(newGroup.productIds, [splitProductId]);
  assert.equal(newGroup.title, splitProduct.goodsTitle);
  assert.equal(newGroup.number, maxNumberBeforeCreate + 1);
  assert.equal(oldGroup.productIds.includes(splitProductId), false);
  assert.equal(
    productsInGroups(state.groups.values()),
    SYNTHETIC_PRODUCT_COUNT,
  );

  const titlesInCategory = [...state.groups.values()]
    .filter((group) => group.categoryId === splitProduct.categoryId)
    .map((group) => group.titleKey);
  assert.equal(new Set(titlesInCategory).size, titlesInCategory.length);

  assert.equal(await useAppStore.getState().undo(), true);
  state = useAppStore.getState();
  assert.equal(state.groups.has(newGroupId), false);
  assert.equal(
    state.groups.get(splitSource.id)?.productIds.includes(splitProductId),
    true,
  );

  // Удаление группы не теряет товары, undo возвращает группу.
  const groupToDelete = [...state.groups.values()].find(
    (g) => g.productIds.length > 1,
  );
  assert.ok(groupToDelete);
  await useAppStore.getState().deleteGroup(groupToDelete.id);
  state = useAppStore.getState();
  assert.equal(state.groups.has(groupToDelete.id), false);
  assert.equal(
    productsInGroups(state.groups.values()),
    SYNTHETIC_PRODUCT_COUNT,
  );
  assert.equal(await useAppStore.getState().undo(), true);
  state = useAppStore.getState();
  assert.equal(state.groups.has(groupToDelete.id), true);
  assert.equal(
    productsInGroups(state.groups.values()),
    SYNTHETIC_PRODUCT_COUNT,
  );

  // Фильтры и размер страницы сохраняются для файла и восстанавливаются.
  const datasetId = state.activeDatasetId;
  assert.ok(datasetId !== null);
  assert.equal(state.pageSize, 50);
  const categoryToSave = [...state.groups.values()][0].categoryId;

  useAppStore.getState().setPageSize(100);
  useAppStore.getState().setPage(3);
  useAppStore.getState().setCardSize("large");
  assert.equal(useAppStore.getState().page, 3);
  assert.equal(useAppStore.getState().pageSize, 100);
  assert.equal(useAppStore.getState().cardSize, "large");

  useAppStore.getState().setCategoryFilter(categoryToSave);
  useAppStore.getState().setQuickFilter("singles");
  useAppStore.getState().setSortBy("title");

  state = useAppStore.getState();
  assert.equal(state.page, 1);
  assert.equal(
    state.filtersByDataset[String(datasetId)]?.categoryFilter,
    categoryToSave,
  );
  assert.equal(
    state.filtersByDataset[String(datasetId)]?.quickFilter,
    "singles",
  );
  assert.equal(state.filtersByDataset[String(datasetId)]?.sortBy, "title");
  assert.equal(state.filtersByDataset[String(datasetId)]?.pageSize, 100);
  assert.equal(state.filtersByDataset[String(datasetId)]?.cardSize, "large");

  await useAppStore.getState().switchDataset(datasetId);
  state = useAppStore.getState();
  assert.equal(state.categoryFilter, categoryToSave);
  assert.equal(state.quickFilter, "singles");
  assert.equal(state.sortBy, "title");
  assert.equal(state.pageSize, 100);
  assert.equal(state.cardSize, "large");
  assert.equal(state.page, 1);

  // Второй файл импортируется и удаляется без потери первого.
  const second = await useAppStore
    .getState()
    .importFile("test-data-second.csv", text);
  assert.equal(useAppStore.getState().datasets.length, 2);
  assert.equal(useAppStore.getState().activeDatasetId, second.datasetId);

  await useAppStore.getState().removeDataset(second.datasetId);
  state = useAppStore.getState();
  assert.equal(state.datasets.length, 1);
  assert.equal(state.datasets.some((item) => item.id === second.datasetId), false);
  assert.equal(state.activeDatasetId, datasetId);
  assert.equal(state.groups.size, SYNTHETIC_GROUP_COUNT);

  // Файл без товаров не создаёт пустой датасет.
  const datasetsBefore = state.datasets.length;
  await assert.rejects(
    useAppStore.getState().importFile("empty.csv", "goods_id\n"),
    /не знайдено/,
  );
  assert.equal(useAppStore.getState().datasets.length, datasetsBefore);
});
