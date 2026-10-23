import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type {
  Dataset,
  Group,
  NewGroup,
  NewGroupForDataset,
  NewProduct,
  Product,
} from "@/lib/types";

/**
 * Схема IndexedDB.
 *
 * Принадлежность товара к группе хранится только в `groups.productIds` —
 * это единственный источник истины. Обратный индекс строится в памяти,
 * поэтому две записи не могут разойтись.
 */
interface AppDB extends DBSchema {
  datasets: {
    key: number;
    value: Dataset;
    indexes: { "by-importedAt": number };
  };
  products: {
    key: number;
    value: Product;
    indexes: { "by-dataset": number; "by-goodsId": string };
  };
  groups: {
    key: number;
    value: Group;
    indexes: { "by-dataset": number; "by-titleKey": string };
  };
  settings: {
    key: string;
    value: { key: string; value: unknown };
  };
  llmCache: {
    key: string;
    value: {
      key: string;
      cleanedTitle: string;
      removed: string[];
      confidence: number;
      model: string;
      promptVersion: string;
      createdAt: number;
    };
  };
}

const DB_NAME = "ccc-groups";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<AppDB>> | null = null;

function getDb(): Promise<IDBPDatabase<AppDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AppDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const datasets = db.createObjectStore("datasets", {
            keyPath: "id",
            autoIncrement: true,
          });
          datasets.createIndex("by-importedAt", "importedAt");

          const products = db.createObjectStore("products", {
            keyPath: "id",
            autoIncrement: true,
          });
          products.createIndex("by-dataset", "datasetId");
          products.createIndex("by-goodsId", "goodsId");

          const groups = db.createObjectStore("groups", {
            keyPath: "id",
            autoIncrement: true,
          });
          groups.createIndex("by-dataset", "datasetId");
          groups.createIndex("by-titleKey", "titleKey");

          db.createObjectStore("settings", { keyPath: "key" });
        }

        if (oldVersion < 2) {
          db.createObjectStore("llmCache", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

/** Результат сохранения датасета. */
export interface SavedDataset {
  datasetId: number;
  /** id товаров в порядке их добавления. */
  productIds: number[];
  /** id групп в порядке их добавления. */
  groupIds: number[];
}

/**
 * Сохраняет датасет с товарами и группами одной транзакцией.
 *
 * Ключи генерируются хранилищем, поэтому `id` в передаваемых объектах
 * отсутствует — иначе все записи получили бы один и тот же ключ.
 */
export async function saveDataset(
  dataset: Omit<Dataset, "id">,
  products: NewProduct[],
  groups: NewGroupForDataset[],
): Promise<SavedDataset> {
  const db = await getDb();
  const tx = db.transaction(["datasets", "products", "groups"], "readwrite");

  const datasetStore = tx.objectStore("datasets");
  const productStore = tx.objectStore("products");
  const groupStore = tx.objectStore("groups");

  // Все запросы отправляем сразу, не дожидаясь каждого по отдельности:
  // так импорт больших файлов проходит заметно быстрее.
  const datasetRequest = datasetStore.add(dataset as Dataset);
  const datasetId = (await datasetRequest) as number;

  // Все запросы товаров и групп отправляем сразу, не дожидаясь каждого:
  // так импорт больших файлов проходит заметно быстрее.
  const productRequests = products.map((product) =>
    productStore.add({ ...product, datasetId } as Product),
  );
  const groupRequests = groups.map((group) =>
    groupStore.add({ ...group, datasetId } as Group),
  );

  const [productIds, groupIds] = await Promise.all([
    Promise.all(productRequests),
    Promise.all(groupRequests),
  ]);

  await tx.done;
  return {
    datasetId,
    productIds: productIds as number[],
    groupIds: groupIds as number[],
  };
}

/** Читает все товары датасета. */
export async function loadProducts(datasetId: number): Promise<Product[]> {
  const db = await getDb();
  return db.getAllFromIndex("products", "by-dataset", datasetId);
}

/** Читает все группы датасета. */
export async function loadGroups(datasetId: number): Promise<Group[]> {
  const db = await getDb();
  return db.getAllFromIndex("groups", "by-dataset", datasetId);
}

/** Читает все датасеты. */
export async function loadDatasets(): Promise<Dataset[]> {
  const db = await getDb();
  const datasets = await db.getAll("datasets");
  return datasets.sort((a, b) => b.importedAt - a.importedAt);
}

/** Создаёт группу и возвращает её id. */
export async function addGroup(group: NewGroup): Promise<number> {
  const db = await getDb();
  return (await db.add("groups", group as Group)) as number;
}

/** Записывает изменённую группу. */
export async function putGroup(group: Group): Promise<void> {
  const db = await getDb();
  await db.put("groups", group);
}

/** Записывает несколько групп одной транзакцией. */
export async function putGroups(groups: Group[]): Promise<void> {
  if (groups.length === 0) return;
  const db = await getDb();
  const tx = db.transaction("groups", "readwrite");
  const store = tx.objectStore("groups");
  await Promise.all(groups.map((group) => store.put(group)));
  await tx.done;
}

/** Удаляет группу. */
export async function deleteGroup(groupId: number): Promise<void> {
  const db = await getDb();
  await db.delete("groups", groupId);
}

/** Удаляет несколько групп одной транзакцией. */
export async function deleteGroups(groupIds: number[]): Promise<void> {
  if (groupIds.length === 0) return;
  const db = await getDb();
  const tx = db.transaction("groups", "readwrite");
  const store = tx.objectStore("groups");
  await Promise.all(groupIds.map((groupId) => store.delete(groupId)));
  await tx.done;
}

/** Обновляет счётчик групп в датасете. */
export async function updateDatasetCounts(
  datasetId: number,
  groupCount: number,
): Promise<void> {
  const db = await getDb();
  const dataset = await db.get("datasets", datasetId);
  if (!dataset) return;
  await db.put("datasets", { ...dataset, groupCount });
}

/** Переименовывает датасет. */
export async function renameDataset(
  datasetId: number,
  name: string,
): Promise<void> {
  const db = await getDb();
  const dataset = await db.get("datasets", datasetId);
  if (!dataset) return;
  await db.put("datasets", { ...dataset, name });
}

/** Удаляет датасет вместе с товарами и группами. */
export async function deleteDataset(datasetId: number): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["datasets", "products", "groups"], "readwrite");

  const datasetStore = tx.objectStore("datasets");
  const productStore = tx.objectStore("products");
  const groupStore = tx.objectStore("groups");

  // Сначала получаем все ключи, затем удаляем записи параллельно.
  const [productKeys, groupKeys] = await Promise.all([
    productStore.index("by-dataset").getAllKeys(datasetId),
    groupStore.index("by-dataset").getAllKeys(datasetId),
  ]);

  await Promise.all([
    datasetStore.delete(datasetId),
    ...productKeys.map((key) => productStore.delete(key)),
    ...groupKeys.map((key) => groupStore.delete(key)),
  ]);

  await tx.done;
}

/** Сохраняет значение в настройках. */
export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.put("settings", { key, value });
}

/** Читает значение из настроек. */
export async function getSetting<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const record = await db.get("settings", key);
  return (record?.value as T) ?? null;
}

/** Читает закэшированный результат очистки названия. */
export async function getLlmCache(
  key: string,
): Promise<AppDB["llmCache"]["value"] | undefined> {
  const db = await getDb();
  return db.get("llmCache", key);
}

/** Сохраняет результат очистки названия в кэш. */
export async function putLlmCache(
  entry: AppDB["llmCache"]["value"],
): Promise<void> {
  const db = await getDb();
  await db.put("llmCache", entry);
}
