"use client";

import { useMemo } from "react";
import { create } from "zustand";

import { parseCategoryCsv } from "@/lib/csv/import-worker";
import { groupProducts } from "@/lib/csv/group";
import { compareCategories } from "@/lib/category/dictionary";
import { seedCategories } from "@/lib/category/seed";
import {
  addCategoryClusters,
  deleteCategoryClusters,
  deleteDataset as dbDeleteDataset,
  getSetting,
  loadCategories,
  loadCategoryClusters,
  loadDatasets,
  loadProducts,
  putCategoryClusters,
  putDataset,
  putGroups,
  saveCategory,
  saveDataset,
  setSetting,
  deleteCategories,
  updateDatasetClusterCount,
} from "@/lib/db/idb";
import { datasetNameFromProducts } from "@/lib/dataset-name";
import { stripTableFileExtension } from "@/lib/file-name";
import { defaultGroupTitle } from "@/lib/grouping/cluster";
import {
  DEFAULT_CARD_WIDTH,
  isCardWidth,
  normalizeCardWidth,
  type CardWidth,
} from "@/lib/card-size";
import {
  DEFAULT_PAGE_SIZE,
  isPageSize,
  type PageSize,
} from "@/lib/pagination";
import type {
  CategoryCluster,
  CategoryEntry,
  CategoryRef,
  Dataset,
  NewCategoryCluster,
  Product,
} from "@/lib/types";

/** Быстрый фильтр кластеров. */
export type CategoryQuickFilter = "attention" | "all" | "changed";

const CATEGORY_ACTIVE_DATASET_KEY = "activeCategoryDatasetId";
const GROUPING_ACTIVE_DATASET_KEY = "activeDatasetId";
const CATEGORY_CARD_SIZE_KEY = "categoryCardSize";
const UNDO_LIMIT = 20;

interface CategoryUndoEntry {
  label: string;
  datasetId: number;
  clusters: CategoryCluster[];
}

/** Стабильный порядок товаров в группе — как в исходном файле. */
function sortProductIds(
  ids: number[],
  products: Map<number, Product>,
): number[] {
  return [...new Set(ids)].sort(
    (a, b) => (products.get(a)?.order ?? 0) - (products.get(b)?.order ?? 0),
  );
}

/** Псевдокатегория для смешанных групп без решения. */
export const ATTENTION_SECTION_ID = "__attention__";

/** Категория, в карточке которой должна показываться группа. */
export function effectiveCategoryId(
  cluster: CategoryCluster,
  products: Map<number, Product>,
): string {
  if (cluster.targetCategoryId) return cluster.targetCategoryId;
  const categories = clusterCategories(cluster, products);
  if (categories.length > 1) return ATTENTION_SECTION_ID;
  return categories[0]?.id ?? "";
}

/** Категории, которые сейчас есть у товаров кластера. */
export function clusterCategories(
  cluster: CategoryCluster,
  products: Map<number, Product>,
): { id: string; title: string; count: number }[] {
  const counts = new Map<string, { id: string; title: string; count: number }>();
  for (const productId of cluster.productIds) {
    const product = products.get(productId);
    if (!product) continue;
    const id = product.originalCategoryId ?? product.categoryId;
    const title =
      product.originalCategoryTitle ?? product.categoryTitle ?? "Без категорії";
    const existing = counts.get(id);
    if (existing) existing.count++;
    else counts.set(id, { id, title, count: 1 });
  }
  return [...counts.values()].sort((a, b) =>
    a.title.localeCompare(b.title, "uk"),
  );
}

/** Категория, которая уйдёт в экспорт для товара. */
export function targetCategoryFor(
  cluster: CategoryCluster | undefined,
  product: Product,
): { id: string; title: string } {
  if (cluster?.targetCategoryId) {
    return {
      id: cluster.targetCategoryId,
      title:
        cluster.targetCategoryTitle ||
        product.originalCategoryTitle ||
        product.categoryTitle ||
        "Без категорії",
    };
  }
  return {
    id: product.originalCategoryId ?? product.categoryId,
    title: product.originalCategoryTitle ?? product.categoryTitle,
  };
}

/** Менялась ли категория кластера относительно исходной. */
export function isClusterChanged(
  cluster: CategoryCluster,
  products: Map<number, Product>,
): boolean {
  if (!cluster.targetCategoryId) return false;
  return cluster.productIds.some((productId) => {
    const product = products.get(productId);
    if (!product) return false;
    return (product.originalCategoryId ?? product.categoryId) !== cluster.targetCategoryId;
  });
}

/** Сколько товаров кластера изменят категорию. */
export function changedProductsCount(
  clusters: Iterable<CategoryCluster>,
  products: Map<number, Product>,
): number {
  let count = 0;
  for (const cluster of clusters) {
    if (!cluster.targetCategoryId) continue;
    for (const productId of cluster.productIds) {
      const product = products.get(productId);
      if (!product) continue;
      if (
        (product.originalCategoryId ?? product.categoryId) !==
        cluster.targetCategoryId
      ) {
        count++;
      }
    }
  }
  return count;
}

/** Название кластера по первому товару. */
function clusterTitle(
  productIds: number[],
  products: Map<number, Product>,
): string {
  const first = productIds
    .map((id) => products.get(id))
    .filter((product): product is Product => product !== undefined)
    .sort((a, b) => a.order - b.order)[0];
  return first ? defaultGroupTitle(first) : "Нова група";
}

/** Следующий свободный номер кластера. */
function nextClusterNumber(clusters: Map<number, CategoryCluster>): number {
  return Math.max(0, ...[...clusters.values()].map((cluster) => cluster.number)) + 1;
}

/** Следующий свободный порядок кластера. */
function nextClusterOrder(clusters: Map<number, CategoryCluster>): number {
  return Math.max(0, ...[...clusters.values()].map((cluster) => cluster.order)) + 1;
}

/** Обновляет счётчик кластеров в локальном списке файлов. */
function withClusterCount(
  datasets: Dataset[],
  datasetId: number,
  clusterCount: number,
): Dataset[] {
  return datasets.map((dataset) =>
    dataset.id === datasetId ? { ...dataset, clusterCount } : dataset,
  );
}

function isCategoryDataset(dataset: Dataset): boolean {
  return dataset.stage === "categories";
}

function resetState() {
  return {
    activeDatasetId: null,
    products: new Map<number, Product>(),
    clusters: new Map<number, CategoryCluster>(),
    orderedClusterIds: [] as number[],
    search: "",
    quickFilter: "all" as CategoryQuickFilter,
    categoryFilter: null as string | null,
    page: 1,
    selectedProductIds: new Set<number>(),
    selectedClusterIds: new Set<number>(),
    undoStack: [] as CategoryUndoEntry[],
  };
}

/** Результат добавления категории в общий справочник. */
export type CategoryAddResult = "ok" | "exists" | "invalid";

interface CategoryState {
  datasets: Dataset[];
  activeDatasetId: number | null;
  /** Глобальный справочник категорий — общий для всего сервиса. */
  dictionary: CategoryEntry[];

  products: Map<number, Product>;
  clusters: Map<number, CategoryCluster>;
  orderedClusterIds: number[];

  search: string;
  quickFilter: CategoryQuickFilter;
  categoryFilter: string | null;
  page: number;
  pageSize: PageSize;
  cardSize: CardWidth;
  selectedProductIds: Set<number>;
  selectedClusterIds: Set<number>;
  undoStack: CategoryUndoEntry[];
  isLoading: boolean;
  lastSavedAt: number | null;

  init: () => Promise<void>;
  switchDataset: (datasetId: number) => Promise<void>;
  importFile: (
    fileName: string,
    text: string,
    onStage?: (stage: "parsing" | "saving") => void,
  ) => Promise<{ datasetId: number; clusterCount: number }>;
  removeDataset: (datasetId: number) => Promise<void>;
  renameDataset: (datasetId: number, name: string) => Promise<boolean>;
  addCategory: (id: string, title: string) => Promise<CategoryAddResult>;
  /** Удаляет все категории, добавленные пользователем вручную. */
  clearUserCategories: () => Promise<number>;

  setSearch: (value: string) => void;
  setQuickFilter: (value: CategoryQuickFilter) => void;
  setCategoryFilter: (value: string | null) => void;
  setPage: (value: number) => void;
  setPageSize: (value: PageSize) => void;
  setCardSize: (value: CardWidth) => void;

  toggleProductSelection: (productId: number) => void;
  clearProductSelection: () => void;
  toggleClusterSelection: (clusterId: number) => void;
  addClusterSelection: (clusterIds: number[]) => void;
  removeClusterSelection: (clusterIds: number[]) => void;
  clearClusterSelection: () => void;

  setClusterTarget: (
    clusterId: number,
    categoryId: string | null,
    categoryTitle: string | null,
  ) => Promise<boolean>;
  moveClustersToCategory: (
    clusterIds: number[],
    categoryId: string,
    categoryTitle: string,
  ) => Promise<number>;
  splitClusterByCategory: (clusterId: number) => Promise<boolean>;
  detachProducts: (clusterId: number, productIds: number[]) => Promise<boolean>;
  mergeClusters: (firstId: number, secondId: number) => Promise<boolean>;
  undo: () => Promise<boolean>;

  transitionToGrouping: () => Promise<number | null>;
}

export const useCategoryStore = create<CategoryState>((set, get) => {
  const recordUndo = (
    before: Map<number, CategoryCluster>,
    label: string,
  ) => {
    const state = get();
    if (state.activeDatasetId === null) return;
    set({
      undoStack: [
        ...state.undoStack,
        {
          label,
          datasetId: state.activeDatasetId,
          clusters: [...before.values()],
        },
      ].slice(-UNDO_LIMIT),
    });
  };

  return {
  datasets: [],
  activeDatasetId: null,
  dictionary: [],
  products: new Map(),
  clusters: new Map(),
  orderedClusterIds: [],
  search: "",
  quickFilter: "all",
  categoryFilter: null,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  cardSize: DEFAULT_CARD_WIDTH,
  selectedProductIds: new Set(),
  selectedClusterIds: new Set(),
  undoStack: [],
  isLoading: false,
  lastSavedAt: null,

  async init() {
    const storedCardSize = await getSetting<number>(CATEGORY_CARD_SIZE_KEY);
    if (isCardWidth(storedCardSize)) {
      set({ cardSize: storedCardSize });
    }

    // Справочник категорий общий для всего сервиса, поэтому при загрузке
    // страницы он сверяется с categorise.json и читается из IndexedDB.
    const [allDatasets, dictionary] = await Promise.all([
      loadDatasets(),
      seedCategories().then(() => loadCategories()),
    ]);
    const datasets = allDatasets.filter(isCategoryDataset);
    set({ datasets, dictionary: [...dictionary].sort(compareCategories) });
    if (datasets.length === 0) return;

    const storedId = await getSetting<number>(CATEGORY_ACTIVE_DATASET_KEY);
    const stored =
      typeof storedId === "number" &&
      datasets.some((dataset) => dataset.id === storedId)
        ? datasets.find((dataset) => dataset.id === storedId)
        : undefined;
    await get().switchDataset(stored?.id ?? datasets[0].id);
  },

  async switchDataset(datasetId) {
    const dataset = get().datasets.find((item) => item.id === datasetId);
    if (!dataset) return;

    set({ isLoading: true });
    try {
      const [storedProducts, storedClusters] = await Promise.all([
        loadProducts(datasetId),
        loadCategoryClusters(datasetId),
      ]);

      // В файлах, созданных до появления исходной категории, она совпадает
      // с текущей.
      const products = storedProducts.map((product) =>
        product.originalCategoryId === undefined
          ? {
              ...product,
              originalCategoryId: product.categoryId,
              originalCategoryTitle: product.categoryTitle,
            }
          : product,
      );

      set({
        activeDatasetId: datasetId,
        products: new Map(products.map((product) => [product.id, product])),
        clusters: new Map(
          storedClusters.map((cluster) => [cluster.id, cluster]),
        ),
        orderedClusterIds: [...storedClusters]
          .sort((a, b) => a.order - b.order)
          .map((cluster) => cluster.id),
        search: "",
        quickFilter: "all",
        categoryFilter: null,
        page: 1,
        selectedProductIds: new Set(),
        selectedClusterIds: new Set(),
        undoStack: [],
        lastSavedAt: Date.now(),
      });
      await setSetting(CATEGORY_ACTIVE_DATASET_KEY, datasetId);
    } finally {
      set({ isLoading: false });
    }
  },

  async importFile(fileName, text, onStage) {
    set({ isLoading: true });
    try {
      onStage?.("parsing");
      const parsed = await parseCategoryCsv(text);
      onStage?.("saving");

      const importedAt = Date.now();
      const datasetName = datasetNameFromProducts(parsed.products, importedAt);
      const draft: Omit<Dataset, "id"> = {
        name: datasetName,
        importedAt,
        rowCount: parsed.products.length,
        groupCount: parsed.clusters.length,
        clusterCount: parsed.clusters.length,
        autoMergedCount: 0,
        columnMap: parsed.columnMap,
        header: parsed.header,
        stage: "categories",
        flow: "categories",
      };

      const saved = await saveDataset(draft, parsed.products, []);
      const productIdByOrder = new Map(
        parsed.products.map((product, index) => [
          product.order,
          saved.productIds[index],
        ]),
      );

      const definitions: NewCategoryCluster[] = parsed.clusters.map(
        (cluster) => ({
          number: cluster.number,
          title: cluster.title,
          order: cluster.order,
          productIds: cluster.memberIndexes
            .map((index) => productIdByOrder.get(parsed.products[index].order))
            .filter((id): id is number => id !== undefined),
          targetCategoryId: null,
          targetCategoryTitle: null,
        }),
      );
      const clusterIds = await addCategoryClusters(
        saved.datasetId,
        definitions,
      );

      const clusters: CategoryCluster[] = definitions.map(
        (cluster, index) => ({
          ...cluster,
          id: clusterIds[index],
          datasetId: saved.datasetId,
        }),
      );
      const products: Product[] = parsed.products.map((product, index) => ({
        ...product,
        id: saved.productIds[index],
        datasetId: saved.datasetId,
      }));
      const datasets = (await loadDatasets()).filter(isCategoryDataset);

      set({
        datasets,
        activeDatasetId: saved.datasetId,
        products: new Map(products.map((product) => [product.id, product])),
        clusters: new Map(clusters.map((cluster) => [cluster.id, cluster])),
        orderedClusterIds: clusters.map((cluster) => cluster.id),
        search: "",
        quickFilter: "all",
        categoryFilter: null,
        page: 1,
        selectedProductIds: new Set(),
        selectedClusterIds: new Set(),
        undoStack: [],
        lastSavedAt: Date.now(),
      });
      await setSetting(CATEGORY_ACTIVE_DATASET_KEY, saved.datasetId);

      return {
        datasetId: saved.datasetId,
        clusterCount: clusters.length,
      };
    } finally {
      set({ isLoading: false });
    }
  },

  async removeDataset(datasetId) {
    const state = get();
    const datasets = state.datasets.filter((dataset) => dataset.id !== datasetId);
    const wasActive = state.activeDatasetId === datasetId;
    set({ datasets, isLoading: true });

    try {
      if (wasActive) {
        if (datasets.length > 0) await get().switchDataset(datasets[0].id);
        else set(resetState());
      }
      await dbDeleteDataset(datasetId);
    } finally {
      set({ isLoading: false });
    }
  },

  async renameDataset(datasetId, name) {
    const value = name.trim();
    if (!value) return false;
    const dataset = get().datasets.find((item) => item.id === datasetId);
    if (!dataset) return false;
    const updated = { ...dataset, name: value };
    await putDataset(updated);
    set({
      datasets: get().datasets.map((item) =>
        item.id === datasetId ? updated : item,
      ),
    });
    return true;
  },

  /**
   * Добавляет категорию в общий справочник сервиса — она не привязана к файлу
   * и будет доступна везде.
   */
  async addCategory(id, title) {
    const categoryId = id.trim();
    const categoryTitle = title.trim();
    if (!categoryId || !categoryTitle) return "invalid";

    const state = get();
    if (state.dictionary.some((item) => item.id === categoryId)) {
      return "exists";
    }

    const entry: CategoryEntry = {
      id: categoryId,
      title: categoryTitle,
      source: "user",
    };
    await saveCategory(entry);
    set({
      dictionary: [...state.dictionary, entry].sort(compareCategories),
    });
    return "ok";
  },

  async clearUserCategories() {
    const state = get();
    const userEntries = state.dictionary.filter(
      (item) => item.source === "user",
    );
    if (userEntries.length === 0) return 0;
    await deleteCategories(userEntries.map((item) => item.id));
    set({
      dictionary: state.dictionary.filter((item) => item.source !== "user"),
    });
    return userEntries.length;
  },

  setSearch(value) {
    set({ search: value, page: 1 });
  },

  setQuickFilter(value) {
    set({ quickFilter: value, page: 1 });
  },

  setCategoryFilter(value) {
    set({ categoryFilter: value, page: 1 });
  },

  setPage(value) {
    set({ page: Math.max(1, Math.floor(value) || 1) });
  },

  setPageSize(value) {
    if (!isPageSize(value)) return;
    set({ pageSize: value, page: 1 });
  },

  setCardSize(value) {
    const cardSize = normalizeCardWidth(value);
    set({ cardSize });
    void setSetting(CATEGORY_CARD_SIZE_KEY, cardSize);
  },

  toggleProductSelection(productId) {
    const next = new Set(get().selectedProductIds);
    if (next.has(productId)) next.delete(productId);
    else next.add(productId);
    set({ selectedProductIds: next });
  },

  clearProductSelection() {
    set({ selectedProductIds: new Set() });
  },

  toggleClusterSelection(clusterId) {
    const next = new Set(get().selectedClusterIds);
    if (next.has(clusterId)) next.delete(clusterId);
    else next.add(clusterId);
    set({ selectedClusterIds: next });
  },

  addClusterSelection(clusterIds) {
    const next = new Set(get().selectedClusterIds);
    for (const id of clusterIds) next.add(id);
    set({ selectedClusterIds: next });
  },

  removeClusterSelection(clusterIds) {
    const next = new Set(get().selectedClusterIds);
    for (const id of clusterIds) next.delete(id);
    set({ selectedClusterIds: next });
  },

  clearClusterSelection() {
    set({ selectedClusterIds: new Set() });
  },

  async setClusterTarget(clusterId, categoryId, categoryTitle) {
    const state = get();
    const before = state.clusters;
    const cluster = state.clusters.get(clusterId);
    if (!cluster) return false;
    const updated: CategoryCluster = {
      ...cluster,
      targetCategoryId: categoryId,
      targetCategoryTitle: categoryTitle,
      manual: true,
    };
    await putCategoryClusters([updated]);
    set({
      clusters: new Map(state.clusters).set(clusterId, updated),
      selectedClusterIds: new Set(
        [...state.selectedClusterIds].filter((id) => id !== clusterId),
      ),
      lastSavedAt: Date.now(),
    });
    recordUndo(before, "Категорію групи змінено");
    return true;
  },

  async moveClustersToCategory(clusterIds, categoryId, categoryTitle) {
    const state = get();
    const ids = [...new Set(clusterIds)].filter((id) => state.clusters.has(id));
    if (ids.length === 0 || !categoryId) return 0;
    const before = state.clusters;

    const next = new Map(state.clusters);
    const updated: CategoryCluster[] = [];
    for (const id of ids) {
      const cluster = next.get(id);
      if (!cluster) continue;
      const changed = {
        ...cluster,
        targetCategoryId: categoryId,
        targetCategoryTitle: categoryTitle,
        manual: true,
      };
      next.set(id, changed);
      updated.push(changed);
    }
    if (updated.length === 0) return 0;

    await putCategoryClusters(updated);
    set({
      clusters: next,
      selectedClusterIds: new Set(),
      lastSavedAt: Date.now(),
    });
    recordUndo(before, "Групи перенесено");
    return updated.length;
  },

  async splitClusterByCategory(clusterId) {
    const state = get();
    const before = state.clusters;
    const cluster = state.clusters.get(clusterId);
    if (!cluster) return false;

    const buckets = new Map<string, number[]>();
    for (const productId of cluster.productIds) {
      const product = state.products.get(productId);
      if (!product) continue;
      const categoryId = product.originalCategoryId ?? product.categoryId;
      const list = buckets.get(categoryId);
      if (list) list.push(productId);
      else buckets.set(categoryId, [productId]);
    }
    if (buckets.size < 2) return false;

    const definitions: NewCategoryCluster[] = [];
    let order = cluster.order;
    let number = nextClusterNumber(state.clusters);
    for (const productIds of buckets.values()) {
      definitions.push({
        number,
        title: clusterTitle(productIds, state.products),
        order,
        productIds: sortProductIds(productIds, state.products),
        targetCategoryId: null,
        targetCategoryTitle: null,
        manual: true,
      });
      order++;
      number++;
    }

    const ids = await addCategoryClusters(cluster.datasetId, definitions);
    await deleteCategoryClusters([clusterId]);

    const next = new Map(state.clusters);
    next.delete(clusterId);
    const created = definitions.map((definition, index) => ({
      ...definition,
      id: ids[index],
      datasetId: cluster.datasetId,
    }));
    for (const item of created) next.set(item.id, item);

    set({
      clusters: next,
      orderedClusterIds: [...next.values()]
        .sort((a, b) => a.order - b.order)
        .map((item) => item.id),
      datasets: withClusterCount(
        state.datasets,
        cluster.datasetId,
        next.size,
      ),
      selectedProductIds: new Set(),
      selectedClusterIds: new Set(),
      lastSavedAt: Date.now(),
    });
    await updateDatasetClusterCount(cluster.datasetId, next.size);
    recordUndo(before, "Групу розділено");
    return true;
  },

  async detachProducts(clusterId, productIds) {
    const state = get();
    const before = state.clusters;
    const cluster = state.clusters.get(clusterId);
    if (!cluster) return false;
    const selected = new Set(productIds);
    const moved = cluster.productIds.filter((id) => selected.has(id));
    const remaining = cluster.productIds.filter((id) => !selected.has(id));
    if (moved.length === 0 || remaining.length === 0) return false;

    const buckets = new Map<string, number[]>();
    for (const productId of moved) {
      const product = state.products.get(productId);
      if (!product) continue;
      const categoryId = product.originalCategoryId ?? product.categoryId;
      const list = buckets.get(categoryId);
      if (list) list.push(productId);
      else buckets.set(categoryId, [productId]);
    }
    if (buckets.size === 0) return false;

    const updated: CategoryCluster = {
      ...cluster,
      title: clusterTitle(remaining, state.products),
      productIds: sortProductIds(remaining, state.products),
      manual: true,
    };

    let order = nextClusterOrder(state.clusters);
    let number = nextClusterNumber(state.clusters);
    const definitions: NewCategoryCluster[] = [];
    for (const ids of buckets.values()) {
      definitions.push({
        number,
        title: clusterTitle(ids, state.products),
        order,
        productIds: sortProductIds(ids, state.products),
        targetCategoryId: null,
        targetCategoryTitle: null,
        manual: true,
      });
      order++;
      number++;
    }

    await putCategoryClusters([updated]);
    const createdIds = await addCategoryClusters(
      cluster.datasetId,
      definitions,
    );

    const next = new Map(state.clusters);
    next.set(clusterId, updated);
    definitions.forEach((definition, index) => {
      const id = createdIds[index];
      next.set(id, {
        ...definition,
        id,
        datasetId: cluster.datasetId,
      });
    });

    set({
      clusters: next,
      orderedClusterIds: [...next.values()]
        .sort((a, b) => a.order - b.order)
        .map((item) => item.id),
      datasets: withClusterCount(
        state.datasets,
        cluster.datasetId,
        next.size,
      ),
      selectedProductIds: new Set(),
      selectedClusterIds: new Set(),
      lastSavedAt: Date.now(),
    });
    await updateDatasetClusterCount(cluster.datasetId, next.size);
    recordUndo(before, "Товари відокремлено");
    return true;
  },

  async mergeClusters(firstId, secondId) {
    if (firstId === secondId) return false;
    const state = get();
    const before = state.clusters;
    const first = state.clusters.get(firstId);
    const second = state.clusters.get(secondId);
    if (!first || !second) return false;

    const targetCategoryId =
      first.targetCategoryId &&
      first.targetCategoryId === second.targetCategoryId
        ? first.targetCategoryId
        : null;
    const targetCategoryTitle =
      targetCategoryId !== null &&
      first.targetCategoryTitle === second.targetCategoryTitle
        ? first.targetCategoryTitle
        : null;
    const productIds = sortProductIds(
      [...first.productIds, ...second.productIds],
      state.products,
    );
    const [target, source] =
      first.number <= second.number ? [first, second] : [second, first];
    const updated: CategoryCluster = {
      ...target,
      title: clusterTitle(productIds, state.products),
      productIds,
      targetCategoryId,
      targetCategoryTitle,
      manual: true,
    };

    await putCategoryClusters([updated]);
    await deleteCategoryClusters([source.id]);

    const next = new Map(state.clusters);
    next.set(target.id, updated);
    next.delete(source.id);

    set({
      clusters: next,
      orderedClusterIds: [...next.values()]
        .sort((a, b) => a.order - b.order)
        .map((item) => item.id),
      datasets: withClusterCount(
        state.datasets,
        target.datasetId,
        next.size,
      ),
      selectedProductIds: new Set(),
      selectedClusterIds: new Set(),
      lastSavedAt: Date.now(),
    });
    await updateDatasetClusterCount(target.datasetId, next.size);
    recordUndo(before, "Групи об’єднано");
    return true;
  },

  async undo() {
    const state = get();
    const entry = state.undoStack[state.undoStack.length - 1];
    if (!entry || entry.datasetId !== state.activeDatasetId) return false;

    const restored = new Map(
      entry.clusters.map((cluster) => [cluster.id, cluster]),
    );
    const addedIds = [...state.clusters.keys()].filter(
      (id) => !restored.has(id),
    );

    await putCategoryClusters([...restored.values()]);
    await deleteCategoryClusters(addedIds);

    set({
      clusters: restored,
      orderedClusterIds: [...restored.values()]
        .sort((a, b) => a.order - b.order)
        .map((cluster) => cluster.id),
      datasets: withClusterCount(
        state.datasets,
        entry.datasetId,
        restored.size,
      ),
      selectedClusterIds: new Set(),
      selectedProductIds: new Set(),
      undoStack: state.undoStack.slice(0, -1),
      lastSavedAt: Date.now(),
    });
    await updateDatasetClusterCount(entry.datasetId, restored.size);
    return true;
  },

  async transitionToGrouping() {
    const state = get();
    const dataset =
      state.activeDatasetId === null
        ? null
        : state.datasets.find((item) => item.id === state.activeDatasetId);
    if (!dataset) return null;

    set({ isLoading: true });
    try {
      const clusterByProduct = new Map<number, CategoryCluster>();
      for (const cluster of state.clusters.values()) {
        for (const productId of cluster.productIds) {
          clusterByProduct.set(productId, cluster);
        }
      }

      const products = [...state.products.values()]
        .sort((a, b) => a.order - b.order)
        .map((product) => {
          const cluster = clusterByProduct.get(product.id);
          const target = targetCategoryFor(cluster, product);
          return {
            ...product,
            categoryId: target.id,
            categoryTitle: target.title,
          };
        });

      const { groups, autoMergedCount } = groupProducts(products);
      if (groups.length === 0) return null;

      // saveDataset создаёт новые записи товаров и сам проставляет им id.
      const productsForSave = products.map((product) => {
        const { id, datasetId, ...rest } = product;
        void id;
        void datasetId;
        return rest;
      });

      const numberByGroup = new Map(
        [...groups]
          .sort(
            (a, b) =>
              a.categoryTitle.localeCompare(b.categoryTitle, "uk") ||
              a.title.localeCompare(b.title, "uk"),
          )
          .map((group, index) => [group, index + 1]),
      );

      const draft: Omit<Dataset, "id"> = {
        name: `${stripTableFileExtension(dataset.name)} · групи.csv`,
        importedAt: Date.now(),
        rowCount: products.length,
        groupCount: groups.length,
        autoMergedCount,
        columnMap: dataset.columnMap,
        header: dataset.header,
        stage: "grouping",
        flow: "categories",
        sourceDatasetId: dataset.id,
      };

      const saved = await saveDataset(
        draft,
        productsForSave,
        groups.map((group, index) => ({
          number: numberByGroup.get(group) ?? index + 1,
          title: group.title,
          titleRaw: group.titleRaw,
          titleKey: group.titleKey,
          titleSource: "derived" as const,
          categoryId: group.categoryId,
          categoryTitle: group.categoryTitle,
          productIds: [],
          order: index,
        })),
      );

      const productIdByOrder = new Map(
        productsForSave.map((product, index) => [
          product.order,
          saved.productIds[index],
        ]),
      );
      const linkedGroups = groups.map((group, index) => ({
        id: saved.groupIds[index],
        datasetId: saved.datasetId,
        number: numberByGroup.get(group) ?? index + 1,
        title: group.title,
        titleRaw: group.titleRaw,
        titleKey: group.titleKey,
        titleSource: "derived" as const,
        categoryId: group.categoryId,
        categoryTitle: group.categoryTitle,
        productIds: group.memberIndexes
          .map((memberIndex) => productIdByOrder.get(products[memberIndex].order))
          .filter((id): id is number => id !== undefined),
        order: index,
      }));
      await putGroups(linkedGroups);
      await setSetting(GROUPING_ACTIVE_DATASET_KEY, saved.datasetId);

      return saved.datasetId;
    } finally {
      set({ isLoading: false });
    }
  },
  };
});

/** Отсортированные и отфильтрованные кластеры активного файла. */
export function useVisibleCategoryClusters(): CategoryCluster[] {
  const clusters = useCategoryStore((s) => s.clusters);
  const products = useCategoryStore((s) => s.products);
  const orderedClusterIds = useCategoryStore((s) => s.orderedClusterIds);
  const search = useCategoryStore((s) => s.search);
  const quickFilter = useCategoryStore((s) => s.quickFilter);
  const categoryFilter = useCategoryStore((s) => s.categoryFilter);

  return useMemo(() => {
    const order =
      orderedClusterIds.length === clusters.size
        ? orderedClusterIds
        : [...clusters.values()]
            .sort((a, b) => a.order - b.order)
            .map((cluster) => cluster.id);
    const query = search.trim().toLowerCase();

    return order
      .map((id) => clusters.get(id))
      .filter((cluster): cluster is CategoryCluster => cluster !== undefined)
      .filter((cluster) => {
        const categories = clusterCategories(cluster, products);
        if (quickFilter === "attention") {
          if (categories.length < 2 || cluster.targetCategoryId) return false;
        }
        if (quickFilter === "changed" && !isClusterChanged(cluster, products)) {
          return false;
        }
        if (categoryFilter !== null) {
          if (!categories.some((category) => category.id === categoryFilter)) {
            return false;
          }
        }
        if (!query) return true;
        if (cluster.title.toLowerCase().includes(query)) return true;
        if (String(cluster.number).includes(query)) return true;
        return cluster.productIds.some((productId) => {
          const product = products.get(productId);
          if (!product) return false;
          return (
            product.goodsTitle.toLowerCase().includes(query) ||
            product.goodsArticle.toLowerCase().includes(query) ||
            product.goodsId.toLowerCase().includes(query)
          );
        });
      });
  }, [
    clusters,
    products,
    orderedClusterIds,
    search,
    quickFilter,
    categoryFilter,
  ]);
}

/** Счётчики для шапки и фильтров. */
export function useCategoryCounters() {
  const products = useCategoryStore((s) => s.products);
  const clusters = useCategoryStore((s) => s.clusters);

  return useMemo(() => {
    const list = [...clusters.values()];
    const mixed = list.filter(
      (cluster) => clusterCategories(cluster, products).length > 1,
    );
    return {
      products: products.size,
      clusters: list.length,
      mixed: mixed.length,
      attention: mixed.filter((cluster) => !cluster.targetCategoryId).length,
      changedProducts: changedProductsCount(list, products),
      changedClusters: list.filter((cluster) =>
        isClusterChanged(cluster, products),
      ).length,
    };
  }, [products, clusters]);
}

/** Секция категории на главном экране. */
export interface CategorySection {
  id: string;
  title: string;
  isAttention: boolean;
  clusters: CategoryCluster[];
  groupCount: number;
  productCount: number;
  changedCount: number;
  mixedCount: number;
}

/** Группы, разложенные по категориям, в которых их нужно показать. */
export function useCategorySections(): CategorySection[] {
  const clusters = useCategoryStore((s) => s.clusters);
  const products = useCategoryStore((s) => s.products);
  const categories = useCategoryOptions();

  return useMemo(() => {
    const byId = new Map<string, CategoryCluster[]>();
    const attention: CategoryCluster[] = [];

    for (const cluster of clusters.values()) {
      const id = effectiveCategoryId(cluster, products);
      if (id === ATTENTION_SECTION_ID) {
        attention.push(cluster);
        continue;
      }
      const list = byId.get(id);
      if (list) list.push(cluster);
      else byId.set(id, [cluster]);
    }

    const makeSection = (
      id: string,
      title: string,
      isAttention: boolean,
      list: CategoryCluster[],
    ): CategorySection => {
      const sorted = [...list].sort(
        (a, b) =>
          a.title.localeCompare(b.title, "uk") || a.number - b.number,
      );
      return {
        id,
        title,
        isAttention,
        clusters: sorted,
        groupCount: sorted.length,
        productCount: sorted.reduce(
          (sum, cluster) => sum + cluster.productIds.length,
          0,
        ),
        changedCount: sorted.filter((cluster) =>
          isClusterChanged(cluster, products),
        ).length,
        mixedCount: sorted.filter(
          (cluster) => clusterCategories(cluster, products).length > 1,
        ).length,
      };
    };

    const known = new Set(categories.map((category) => category.id));
    const sections = categories.map((category) =>
      makeSection(
        category.id,
        category.title,
        false,
        byId.get(category.id) ?? [],
      ),
    );

    for (const [id, list] of byId) {
      if (known.has(id)) continue;
      const first = list[0];
      const firstProduct = first ? products.get(first.productIds[0]) : undefined;
      sections.push(
        makeSection(
          id,
          first?.targetCategoryTitle ||
            firstProduct?.originalCategoryTitle ||
            firstProduct?.categoryTitle ||
            "Без категорії",
          false,
          list,
        ),
      );
    }

    sections.sort((a, b) => a.title.localeCompare(b.title, "uk"));

    const attentionSection = makeSection(
      ATTENTION_SECTION_ID,
      "Потребують уваги",
      true,
      attention,
    );

    return attention.length > 0 ? [attentionSection, ...sections] : sections;
  }, [clusters, products, categories]);
}

/** Все категории файла: из товаров и добавленные вручную. */
export function useCategoryOptions(): CategoryRef[] {
  const activeDatasetId = useCategoryStore((s) => s.activeDatasetId);
  const datasets = useCategoryStore((s) => s.datasets);
  const products = useCategoryStore((s) => s.products);

  return useMemo(() => {
    const map = new Map<string, CategoryRef>();
    for (const product of products.values()) {
      const id = product.originalCategoryId ?? product.categoryId;
      const title =
        product.originalCategoryTitle ??
        product.categoryTitle ??
        "Без категорії";
      if (!map.has(id)) map.set(id, { id, title });
    }
    const dataset = datasets.find((item) => item.id === activeDatasetId);
    for (const category of dataset?.extraCategories ?? []) {
      map.set(category.id, category);
    }
    return [...map.values()].sort((a, b) =>
      a.title.localeCompare(b.title, "uk"),
    );
  }, [activeDatasetId, datasets, products]);
}

/**
 * Категории для выбора целевой категории: общий справочник сервиса плюс
 * категории, которых нет в справочнике, но есть в текущем файле.
 */
export function useCategoryPickerOptions(): CategoryRef[] {
  const dictionary = useCategoryStore((s) => s.dictionary);
  const options = useCategoryOptions();

  return useMemo(() => {
    const map = new Map<string, CategoryRef>();
    for (const category of dictionary) map.set(category.id, category);
    for (const category of options) {
      if (!map.has(category.id)) map.set(category.id, category);
    }
    return [...map.values()].sort(compareCategories);
  }, [dictionary, options]);
}
