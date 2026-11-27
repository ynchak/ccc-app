import "fake-indexeddb/auto";

import assert from "node:assert/strict";
import { test } from "node:test";

import { matchesCategoryQuery } from "@/lib/category/dictionary";
import { parseSeedCategories, seedCategories } from "@/lib/category/seed";
import { loadCategories, putCategories } from "@/lib/db/idb";

test("справочник: разбор json пропускает неполные записи и ставит uk выше ru", () => {
  const parsed = parseSeedCategories([
    { id: 4655583, category_title_ru: "Форменная одежда" },
    { id: 4655584, category_title_ru: "Костюмы", category_title_uk: "Костюми" },
    { id: "", category_title_ru: "Без ID" },
    { id: 4655585 },
    null,
    "мусор",
  ]);

  assert.deepEqual(
    parsed.map((entry) => entry.id),
    ["4655583", "4655584"],
  );
  assert.equal(parsed[0].title, "Форменная одежда");
  assert.equal(parsed[0].source, "seed");
  assert.equal(parsed[1].title, "Костюми");
  assert.equal(parsed[1].titleRu, "Костюмы");
  assert.equal(parsed[1].titleUk, "Костюми");
});

test("справочник: categorise.json загружается в IndexedDB и сид идемпотентен", async () => {
  const first = await seedCategories();
  const stored = await loadCategories();

  assert.ok(first.added > 0, "первый сид должен добавить записи");
  assert.equal(first.updated, 0);
  assert.equal(stored.length, first.added);
  assert.ok(
    stored.some((entry) => entry.id === "4655583"),
    "категория из json должна попасть в базу",
  );

  const second = await seedCategories();
  assert.deepEqual(second, { added: 0, updated: 0 });
  assert.equal((await loadCategories()).length, stored.length);
});

test("справочник: правки из json подхватываются, а пользовательские не трогаются", async () => {
  await seedCategories();

  const userEntry = {
    id: "999001",
    title: "Власна категорія",
    source: "user" as const,
  };
  const seedEntry = (await loadCategories()).find(
    (entry) => entry.source === "seed",
  );
  assert.ok(seedEntry, "в справочнике должна быть запись сида");

  await putCategories([userEntry, { ...seedEntry, title: "Стара назва" }]);
  const seeded = await seedCategories();
  const stored = await loadCategories();
  const updated = stored.find((entry) => entry.id === seedEntry.id);
  const user = stored.find((entry) => entry.id === userEntry.id);

  assert.equal(seeded.updated, 1, "заголовок сида обновляется из json");
  assert.equal(updated?.title, seedEntry.title);
  assert.equal(user?.title, "Власна категорія", "правка пользователя сохраняется");
  assert.equal(user?.source, "user");
});

test("справочник: поиск мультиязычный — по id и по обоим названиям", () => {
  const category = {
    id: "4655584",
    title: "Костюми",
    titleRu: "Костюмы",
    titleUk: "Костюми",
  };

  assert.ok(matchesCategoryQuery(category, "костюмы"));
  assert.ok(matchesCategoryQuery(category, "Костюми"));
  assert.ok(matchesCategoryQuery(category, "46555"));
  assert.ok(!matchesCategoryQuery(category, "обувь"));
  // Категория файла без перевода находится по своему названию и id.
  assert.ok(matchesCategoryQuery({ id: "7", title: "Форменная одежда" }, "формен"));
  assert.ok(matchesCategoryQuery({ id: "7", title: "Форменная одежда" }, "7"));
  // Пустой запрос подходит всем.
  assert.ok(matchesCategoryQuery(category, "   "));
});

test("справочник: добавление категории общее для сервиса, а не для файла", async () => {
  const { useCategoryStore } = await import("@/lib/store/category-store");
  await useCategoryStore.getState().init();

  assert.ok(
    useCategoryStore.getState().dictionary.length >= 354,
    "после init справочник должен быть заполнен из categorise.json",
  );

  assert.equal(
    await useCategoryStore.getState().addCategory("  ", "  "),
    "invalid",
  );
  assert.equal(
    await useCategoryStore.getState().addCategory("4655583", "Дубль"),
    "exists",
    "существующий id не перезаписывается",
  );

  assert.equal(
    await useCategoryStore.getState().addCategory("777001", "Нова категорія"),
    "ok",
  );
  const added = useCategoryStore
    .getState()
    .dictionary.find((entry) => entry.id === "777001");
  assert.equal(added?.title, "Нова категорія");
  assert.equal(added?.source, "user");

  // «Перезагрузка страницы»: init заново читает справочник из IndexedDB.
  await useCategoryStore.getState().init();
  const reloaded = useCategoryStore
    .getState()
    .dictionary.find((entry) => entry.id === "777001");
  assert.equal(reloaded?.title, "Нова категорія");
  assert.equal(reloaded?.source, "user");
});
