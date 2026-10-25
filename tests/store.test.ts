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
  useAppStore.getState().setCardSize(340);
  assert.equal(useAppStore.getState().page, 3);
  assert.equal(useAppStore.getState().pageSize, 100);
  assert.equal(useAppStore.getState().cardSize, 340);

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
  assert.equal(state.filtersByDataset[String(datasetId)]?.cardSize, 340);

  await useAppStore.getState().switchDataset(datasetId);
  state = useAppStore.getState();
  assert.equal(state.categoryFilter, categoryToSave);
  assert.equal(state.quickFilter, "singles");
  assert.equal(state.sortBy, "title");
  assert.equal(state.pageSize, 100);
  assert.equal(state.cardSize, 340);
  assert.equal(state.page, 1);

  // Последняя просмотренная группа сохраняется и восстанавливается при
  // повторном открытии файла.
  useAppStore.getState().setCategoryFilter(null);
  useAppStore.getState().setQuickFilter("all");
  state = useAppStore.getState();
  const { filterVisibleGroups } = await import("@/lib/store/app-store");
  const visible = filterVisibleGroups({
    groups: state.groups,
    products: state.products,
    orderedGroupIds: state.orderedGroupIds,
    sortBy: state.sortBy,
    search: "",
    categoryFilter: state.categoryFilter,
    quickFilter: state.quickFilter,
  });
  const lastVisible = visible[visible.length - 1];
  assert.ok(lastVisible);

  useAppStore.getState().setLastViewedGroupNumber(lastVisible.number);
  state = useAppStore.getState();
  assert.equal(
    state.filtersByDataset[String(datasetId)]?.lastViewedGroupNumber,
    lastVisible.number,
  );

  await useAppStore.getState().switchDataset(datasetId);
  state = useAppStore.getState();
  assert.equal(state.restoreGroupRequest?.groupId, lastVisible.id);
  assert.equal(
    state.page,
    Math.floor((visible.length - 1) / state.pageSize) + 1,
  );

  // Второй файл импортируется и удаляется без потери первого.
  const second = await useAppStore
    .getState()
    .importFile("test-data-second.csv", text);
  assert.ok(second);
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

  // Отмена предпросмотра не создаёт датасет.
  let previewCalled = false;
  const canceled = await useAppStore
    .getState()
    .importFile("cancel.csv", text, undefined, async () => {
      previewCalled = true;
      return false;
    });
  assert.equal(canceled, null);
  assert.equal(previewCalled, true);
  assert.equal(useAppStore.getState().datasets.length, datasetsBefore);
});

test("store: после автоочистки названий список сортируется", async () => {
  const { useAppStore } = await import("@/lib/store/app-store");

  await useAppStore
    .getState()
    .importFile("sort-after-cleanup.csv", SYNTHETIC_CSV);
  let state = useAppStore.getState();
  assert.equal(state.sortBy, "category");

  const ordered = state.orderedGroupIds
    .map((id) => state.groups.get(id))
    .filter((group): group is Group => group !== undefined);
  const clothing = ordered.filter((group) => group.categoryId === "100");
  assert.ok(clothing.length >= 2, "нужна категория с двумя группами");
  const first = clothing[0];
  const last = clothing[clothing.length - 1];

  // Очистка поменяет названия так, что группы должны поменяться местами.
  const newTitles = new Map<number, string>([
    [first.id, "ЯЯЯ Платье тестовое"],
    [last.id, "ААА Платье тестовое"],
  ]);

  // Автосортировка должна вернуть на первую страницу.
  useAppStore.getState().setPage(2);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const method = (init?.method ?? "GET").toUpperCase();

    if (url === "/api/group-matches") {
      return new Response(null, { status: 503 });
    }
    if (url !== "/api/clean-titles") {
      throw new Error(`неожиданный запрос: ${method} ${url}`);
    }
    if (method === "GET") {
      return Response.json({
        configured: true,
        model: "test-model",
        promptVersion: "test-version",
      });
    }

    const body = JSON.parse(String(init?.body ?? "{}")) as {
      items: Array<{ id: string; title: string }>;
    };
    return Response.json({
      results: body.items.map((item) => ({
        id: item.id,
        title: newTitles.get(Number(item.id)) ?? item.title,
        originalTitle: item.title,
        removed: [],
        confidence: 1,
      })),
      model: "test-model",
      promptVersion: "test-version",
      usage: { cost: 0 },
    });
  }) as typeof fetch;

  try {
    const result = await useAppStore.getState().cleanTitlesWithLlm();
    assert.equal(result.skipped, false);
    assert.ok(result.cleaned >= 2);
  } finally {
    globalThis.fetch = originalFetch;
  }

  state = useAppStore.getState();
  assert.equal(state.page, 1);

  // Весь список идёт по текущему правилу сортировки: категория, затем название.
  const sorted = state.orderedGroupIds
    .map((id) => state.groups.get(id))
    .filter((group): group is Group => group !== undefined);
  for (let index = 1; index < sorted.length; index++) {
    const previous = sorted[index - 1];
    const current = sorted[index];
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

  // Группа с названием «ААА…» теперь стоит раньше «ЯЯЯ…».
  const firstIndex = state.orderedGroupIds.indexOf(first.id);
  const lastIndex = state.orderedGroupIds.indexOf(last.id);
  assert.ok(firstIndex >= 0 && lastIndex >= 0);
  assert.ok(lastIndex < firstIndex);
});

test("store: экранированные названия очищаются при импорте", async () => {
  const { useAppStore } = await import("@/lib/store/app-store");

  const csv = SYNTHETIC_CSV.replace(
    "Платье тестовое M100",
    "Платье м\\'ятное M100",
  );
  await useAppStore.getState().importFile("escaped-title.csv", csv);

  const state = useAppStore.getState();
  const group = [...state.groups.values()].find((item) =>
    item.title.includes("Платье"),
  );
  assert.ok(group, "группа должна найтись");
  assert.ok(group.title.includes("м'ятное"));
  assert.equal(group.title.includes("\\"), false);

  const firstProduct = state.products.get(group.productIds[0]);
  assert.ok(firstProduct, "товар должен найтись");
  assert.ok(firstProduct.goodsTitle.includes("м'ятное"));
  assert.equal(firstProduct.goodsTitle.includes("\\"), false);

  // Файлы, сохранённые до очистки, исправляются при загрузке.
  const datasetId = state.activeDatasetId;
  assert.ok(datasetId !== null);
  const { putGroups, putProducts } = await import("@/lib/db/idb");
  await putProducts([{ ...firstProduct, goodsTitle: "Платье м\\'ятное" }]);
  await putGroups([
    { ...group, title: "Платье м\\'ятное", titleRaw: "Платье м\\'ятное" },
  ]);

  await useAppStore.getState().switchDataset(datasetId);
  const reloaded = useAppStore.getState();
  const reloadedGroup = reloaded.groups.get(group.id);
  assert.ok(reloadedGroup);
  assert.equal(reloadedGroup.title, "Платье м'ятное");
  assert.equal(reloadedGroup.titleRaw, "Платье м'ятное");
  assert.equal(reloadedGroup.titleKey, "платье м'ятное");
  assert.equal(
    reloaded.products.get(group.productIds[0])?.goodsTitle,
    "Платье м'ятное",
  );
});

test("store: после объединения групп выбор сбрасывается", async () => {
  const { useAppStore } = await import("@/lib/store/app-store");
  await useAppStore
    .getState()
    .importFile("merge-selection.csv", SYNTHETIC_CSV);

  const state = useAppStore.getState();
  const byCategory = new Map<string, Group[]>();
  for (const id of state.orderedGroupIds) {
    const group = state.groups.get(id);
    if (!group) continue;
    const list = byCategory.get(group.categoryId) ?? [];
    list.push(group);
    byCategory.set(group.categoryId, list);
  }

  const triple = [...byCategory.values()].find((list) => list.length >= 3);
  assert.ok(triple, "нужна категория с тремя группами");

  const ids = triple.slice(0, 3).map((group) => group.id);
  for (const id of ids) useAppStore.getState().toggleGroupSelection(id);
  assert.equal(useAppStore.getState().selectedGroupIds.size, 3);

  const groupsBefore = useAppStore.getState().groups.size;
  const ok = await useAppStore.getState().mergeGroups(ids, ids[0]);
  assert.equal(ok, true);
  assert.equal(useAppStore.getState().groups.size, groupsBefore - 2);
  assert.equal(useAppStore.getState().selectedGroupIds.size, 0);
});

/** Мок ответов Jev: отвечает на пары из батча или только на часть. */
function mockJevFetch(options: {
  answer: (
    pairs: Array<{ a: { id: string }; b: { id: string } }>,
    call: number,
  ) => Array<{ aId: string; bId: string; sameType: number; sameModel: number }>;
}) {
  let call = 0;
  const requestSizes: number[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const method = (init?.method ?? "GET").toUpperCase();

    if (url === "/api/clean-titles") {
      if (method === "GET") {
        return Response.json({
          configured: true,
          model: "test-model",
          promptVersion: "test-version",
        });
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        items: Array<{ id: string; title: string }>;
      };
      return Response.json({
        results: body.items.map((item) => ({
          id: item.id,
          title: item.title,
          originalTitle: item.title,
          removed: [],
          confidence: 1,
        })),
        model: "test-model",
        promptVersion: "test-version",
        usage: { cost: 0 },
      });
    }

    if (url === "/api/group-matches") {
      if (method === "GET") {
        return Response.json({
          configured: true,
          model: "jev-test",
          promptVersion: "test-version",
        });
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        pairs: Array<{ a: { id: string }; b: { id: string } }>;
      };
      call++;
      requestSizes.push(body.pairs.length);
      return Response.json({
        results: options.answer(body.pairs, call),
        model: "jev-test",
        promptVersion: "test-version",
        usage: {},
      });
    }

    throw new Error(`неожиданный запрос: ${method} ${url}`);
  }) as typeof fetch;

  return {
    requestSizes,
    calls: () => call,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

test("store: Jev повторяет пары, на которые не пришёл ответ", async () => {
  const { useAppStore } = await import("@/lib/store/app-store");
  const csv = SYNTHETIC_CSV.replaceAll("тестовое", "Jev-retry");
  await useAppStore.getState().importFile("jev-retry.csv", csv);

  let firstRequest = true;
  const mock = mockJevFetch({
    answer: (pairs) => {
      // На первом запросе намеренно теряем последнюю пару.
      const answered = firstRequest ? pairs.slice(0, -1) : pairs;
      firstRequest = false;
      return answered.map((pair) => ({
        aId: pair.a.id,
        bId: pair.b.id,
        sameType: 0.9,
        sameModel: 0.9,
      }));
    },
  });

  try {
    const result = await useAppStore.getState().cleanTitlesWithLlm();
    assert.equal(result.jevFailed, false);
    assert.ok((result.jevPairs ?? 0) > 0);
    assert.equal(result.jevAnswered, result.jevPairs);
    assert.ok((result.jevCandidates ?? 0) >= (result.jevPairs ?? 0));
    assert.ok(mock.calls() >= 2);
    assert.ok(mock.requestSizes.includes(1), "должен был быть ретрай пары");
  } finally {
    mock.restore();
  }
});

test("store: неотвеченные пары Jev видны в результате", async () => {
  const { useAppStore } = await import("@/lib/store/app-store");
  const csv = SYNTHETIC_CSV.replaceAll("тестовое", "Jev-missing");
  await useAppStore.getState().importFile("jev-missing.csv", csv);

  const mock = mockJevFetch({
    // Отвечаем только на первую пару в каждом запросе.
    answer: (pairs) =>
      pairs.slice(0, 1).map((pair) => ({
        aId: pair.a.id,
        bId: pair.b.id,
        sameType: 0.9,
        sameModel: 0.9,
      })),
  });
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    const result = await useAppStore.getState().cleanTitlesWithLlm();
    assert.equal(result.jevFailed, true);
    assert.ok((result.jevPairs ?? 0) > 0);
    assert.ok((result.jevAnswered ?? 0) < (result.jevPairs ?? 0));
  } finally {
    console.warn = originalWarn;
    mock.restore();
  }
});

test("findGroupIndexByNumber: точное совпадение и ближайший номер", async () => {
  const { findGroupIndexByNumber } = await import("@/lib/store/app-store");
  const groups = [1, 5, 9].map((number) => ({ number })) as unknown as Group[];
  assert.equal(findGroupIndexByNumber(groups, 5), 1);
  assert.equal(findGroupIndexByNumber(groups, 6), 1);
  assert.equal(findGroupIndexByNumber(groups, 8), 2);
  assert.equal(findGroupIndexByNumber([], 3), -1);
});
