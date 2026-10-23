"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { parseAndGroupCsv } from "@/lib/csv/import-worker";
import {
  addGroup,
  deleteDataset as dbDeleteDataset,
  deleteGroups,
  getSetting,
  loadDatasets,
  loadGroups,
  loadProducts,
  getLlmCache,
  putLlmCache,
  putGroups,
  renameDataset as dbRenameDataset,
  saveDataset,
  setSetting,
  updateDatasetCounts,
} from "@/lib/db/idb";
import {
  defaultGroupTitle,
  normalizeTitle,
} from "@/lib/grouping/cluster";
import { normalizeGroupNumbers } from "@/lib/grouping/numbering";
import {
  LlmNotConfiguredError,
  LlmRequestError,
  cleanTitlesBatch,
  fetchCleanupStatus,
} from "@/lib/llm/client";
import type { CleanTitleInput, CleanTitleResult } from "@/lib/llm/title-cleanup";
import {
  JevNotConfiguredError,
  JevRequestError,
  fetchJevStatus,
  matchPairsBatch,
} from "@/lib/jev/client";
import { buildJevGroupProfile, generateCandidatePairs } from "@/lib/jev/candidates";
import { applyJevDecisions } from "@/lib/jev/merge";
import type {
  CandidatePair,
  JevGroupProfile,
  JevPair,
  JevPairResult,
  MergeSuggestion,
} from "@/lib/jev/types";
import {
  DEFAULT_CARD_WIDTH,
  normalizeCardWidth,
  type CardWidth,
} from "@/lib/card-size";
import {
  DEFAULT_PAGE_SIZE,
  isPageSize,
  type PageSize,
} from "@/lib/pagination";
import type { Dataset, Group, Product } from "@/lib/types";

/** Сортировка групп. */
export type SortBy = "order" | "title" | "count" | "category";

/** Быстрый фильтр групп. */
export type QuickFilter = "all" | "singles";

/** Сохраняемые настройки отображения для одного файла. */
export interface DatasetFilters {
  categoryFilter: string | null;
  quickFilter: QuickFilter;
  sortBy: SortBy;
  pageSize: PageSize;
  cardSize: CardWidth;
}

/** Настройки по умолчанию. */
const DEFAULT_FILTERS: DatasetFilters = {
  categoryFilter: null,
  quickFilter: "all",
  sortBy: "category",
  pageSize: DEFAULT_PAGE_SIZE,
  cardSize: DEFAULT_CARD_WIDTH,
};

/** Безопасное хранилище для SSR. */
const filterStorage = createJSONStorage<Pick<AppState, "filtersByDataset">>(
  () =>
    typeof window !== "undefined"
      ? window.localStorage
      : {
          getItem: () => null,
          setItem: () => undefined,
          removeItem: () => undefined,
        },
);

/** Результат автоматической очистки названий. */
export interface CleanupRunResult {
  total: number;
  cleaned: number;
  merged: number;
  /** Сколько групп объединено вторым слоем Jev. */
  modelMerged: number;
  /** Пары, которые Jev считает вероятными, но не автоматическими. */
  suggestions: MergeSuggestion[];
  failed: number;
  jevSkipped: boolean;
  jevFailed: boolean;
  skipped: boolean;
}

/** Запись истории для undo. */
interface UndoEntry {
  label: string;
  groups: Group[];
  orderedGroupIds: number[];
}

/** Состояние приложения. */
interface AppState {
  datasets: Dataset[];
  activeDatasetId: number | null;

  products: Map<number, Product>;
  groups: Map<number, Group>;
  /** Стабильный порядок групп в списке. Меняется при сортировке, но не при переименовании. */
  orderedGroupIds: number[];
  /** Производный индекс: товар → группа. */
  productToGroup: Map<number, number>;

  search: string;
  categoryFilter: string | null;
  sortBy: SortBy;
  quickFilter: QuickFilter;
  /** Настройки фильтров по datasetId — переживают перезагрузку страницы. */
  filtersByDataset: Record<string, DatasetFilters>;
  /** Текущая страница списка групп (1-based). */
  page: number;
  pageSize: PageSize;
  /** Размер карточек товаров. */
  cardSize: CardWidth;
  selectedGroupIds: Set<number>;
  selectedProductIds: Set<number>;
  /** Пары групп, которые Jev предлагает объединить, но не делает это сам. */
  mergeSuggestions: MergeSuggestion[];
  undoStack: UndoEntry[];
  isLoading: boolean;
  lastSavedAt: number | null;

  init: () => Promise<void>;
  importFile: (
    fileName: string,
    text: string,
    onStage?: (stage: "grouping" | "saving") => void,
  ) => Promise<{ datasetId: number; autoMergedCount: number }>;
  switchDataset: (datasetId: number) => Promise<void>;
  removeDataset: (datasetId: number) => Promise<void>;
  renameDataset: (datasetId: number, name: string) => Promise<boolean>;

  setSearch: (value: string) => void;
  setCategoryFilter: (value: string | null) => void;
  setSortBy: (value: SortBy) => void;
  resort: () => void;
  setQuickFilter: (value: QuickFilter) => void;
  setPage: (value: number) => void;
  setPageSize: (value: PageSize) => void;
  setCardSize: (value: CardWidth) => void;
  toggleGroupSelection: (groupId: number) => void;
  clearGroupSelection: () => void;
  toggleProductSelection: (productId: number) => void;
  selectProducts: (productIds: number[]) => void;
  clearProductSelection: () => void;

  renameGroup: (groupId: number, newTitle: string) => Promise<boolean>;
  mergeGroups: (groupIds: number[], targetId: number) => Promise<boolean>;
  moveProduct: (productId: number, toGroupId: number) => Promise<boolean>;
  moveProducts: (productIds: number[], toGroupId: number) => Promise<boolean>;
  createGroupFromProduct: (
    productId: number,
    title?: string,
  ) => Promise<number | null>;
  createGroupFromProducts: (
    productIds: number[],
    title?: string,
  ) => Promise<number | null>;
  removeProductFromGroup: (productId: number) => Promise<void>;
  detachProducts: (productIds: number[]) => Promise<boolean>;
  deleteGroup: (groupId: number) => Promise<void>;
  cleanTitlesWithLlm: (
    onProgress?: (done: number, total: number) => void,
  ) => Promise<CleanupRunResult>;
  resetGroupTitle: (groupId: number) => Promise<boolean>;
  applyMergeSuggestion: (aId: number, bId: number) => Promise<boolean>;
  dismissMergeSuggestion: (aId: number, bId: number) => void;
  clearMergeSuggestions: () => void;
  undo: () => Promise<boolean>;
}

const ACTIVE_DATASET_KEY = "activeDatasetId";
const UNDO_LIMIT = 20;

/** Собирает индекс товар → группа. */
function buildProductToGroup(groups: Group[]): Map<number, number> {
  const index = new Map<number, number>();
  for (const group of groups) {
    for (const productId of group.productIds) index.set(productId, group.id);
  }
  return index;
}

/** Сортирует id товаров в порядке исходного файла. */
function sortProductIds(
  ids: number[],
  products: Map<number, Product>,
): number[] {
  return [...ids].sort(
    (a, b) => (products.get(a)?.order ?? 0) - (products.get(b)?.order ?? 0),
  );
}

/** Удаляет товары из всех групп, кроме указанной. */
function removeFromOtherGroups(
  groups: Map<number, Group>,
  productIds: Set<number>,
  keepGroupId: number,
): void {
  for (const [id, group] of groups) {
    if (id === keepGroupId) continue;
    if (!group.productIds.some((productId) => productIds.has(productId))) {
      continue;
    }
    groups.set(id, {
      ...group,
      productIds: group.productIds.filter(
        (productId) => !productIds.has(productId),
      ),
    });
  }
}

/**
 * Удаляет группы, которые опустели в результате операции.
 * Ранее созданные пустые группы не трогаем — пользователь мог оставить их
 * намеренно как место для будущих товаров.
 */
function dropEmptiedGroups(
  groups: Map<number, Group>,
  before: Map<number, Group>,
  keepId?: number,
): void {
  for (const [id, group] of groups) {
    if (id === keepId) continue;
    if (group.productIds.length > 0) continue;
    const previous = before.get(id);
    if (previous && previous.productIds.length > 0) groups.delete(id);
  }
}

/** Делит массив на батчи. */
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/** Строит профили групп и пары для Jev. */
function buildJevPairs(
  groups: Map<number, Group>,
  products: Map<number, Product>,
  candidates: CandidatePair[],
): JevPair[] {
  const profiles = new Map<number, JevGroupProfile>();
  for (const group of groups.values()) {
    const profile = buildJevGroupProfile(group, products);
    if (profile) profiles.set(group.id, profile);
  }

  return candidates
    .map((pair) => {
      const a = profiles.get(pair.aId);
      const b = profiles.get(pair.bId);
      return a && b ? { a, b } : null;
    })
    .filter((pair): pair is JevPair => pair !== null);
}

/** Ключ кэша очистки названия. */
function cleanupCacheKey(
  input: CleanTitleInput,
  model: string,
  promptVersion: string,
): string {
  return JSON.stringify({
    model,
    promptVersion,
    title: input.title,
    brand: input.brand ?? "",
    article: input.article ?? "",
    size: input.size ?? "",
    color: input.color ?? "",
    height: input.height ?? "",
    category: input.category ?? "",
  });
}

/**
 * Уникальное название группы внутри категории.
 * Нужно, когда новую группу создают из товара, а группа с таким названием
 * уже существует.
 */
function uniqueGroupTitle(
  groups: Map<number, Group>,
  categoryId: string,
  base: string,
): string {
  const title = base.trim() || "Нова група";
  const taken = new Set(
    [...groups.values()]
      .filter((group) => group.categoryId === categoryId)
      .map((group) => group.titleKey),
  );
  if (!taken.has(normalizeTitle(title))) return title;

  let counter = 2;
  while (taken.has(normalizeTitle(`${title} (${counter})`))) counter++;
  return `${title} (${counter})`;
}

/**
 * Обновляет автоматические названия групп после перемещения товаров.
 * Группы, переименованные вручную, и переданные исключения не трогаем.
 */
function refreshDerivedTitles(
  groups: Map<number, Group>,
  products: Map<number, Product>,
  skipIds?: Set<number>,
): void {
  for (const [id, group] of groups) {
    if (skipIds?.has(id)) continue;
    if (group.titleSource !== "derived" || group.productIds.length === 0) {
      continue;
    }
    const first = products.get(group.productIds[0]);
    if (!first) continue;
    const title = defaultGroupTitle(first);
    const titleKey = normalizeTitle(title);
    if (title === group.title && titleKey === group.titleKey) continue;
    groups.set(id, { ...group, title, titleKey });
  }
}

/** Помечает группы как изменённые вручную. */
function markManual(
  groups: Map<number, Group>,
  ids: Iterable<number>,
): void {
  for (const id of new Set(ids)) {
    const group = groups.get(id);
    if (!group || group.manual) continue;
    groups.set(id, { ...group, manual: true });
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      /** Пишет в IndexedDB только изменённые и удалённые группы. */
  const persistDiff = async (
    before: Map<number, Group>,
    after: Map<number, Group>,
  ) => {
    const changed = [...after.values()].filter(
      (group) => before.get(group.id) !== group,
    );
    await putGroups(changed);

    const removed = [...before.keys()].filter((id) => !after.has(id));
    await deleteGroups(removed);
  };

  /** Фиксирует изменение групп, сохраняет его и добавляет запись в undo. */
  const commit = async (
    before: Map<number, Group>,
    after: Map<number, Group>,
    label: string,
  ) => {
    await persistDiff(before, after);

    const state = get();
    const datasetId = state.activeDatasetId;
    const datasets =
      datasetId === null
        ? state.datasets
        : state.datasets.map((dataset) =>
            dataset.id === datasetId
              ? { ...dataset, groupCount: after.size }
              : dataset,
          );

    set({
      groups: after,
      orderedGroupIds: buildStableOrder(
        state.orderedGroupIds,
        after,
        state.sortBy,
      ),
      productToGroup: buildProductToGroup([...after.values()]),
      mergeSuggestions: state.mergeSuggestions.filter(
        (suggestion) =>
          after.has(suggestion.aId) && after.has(suggestion.bId),
      ),
      datasets,
      undoStack: [
        ...state.undoStack,
        {
          label,
          groups: [...before.values()],
          orderedGroupIds: [...state.orderedGroupIds],
        },
      ].slice(-UNDO_LIMIT),
      lastSavedAt: Date.now(),
      selectedProductIds: new Set(),
    });

    if (datasetId !== null) {
      await updateDatasetCounts(datasetId, after.size);
    }
  };

  /** Настройки отображения, сохранённые для файла. */
  const getFiltersForDataset = (datasetId: number | null): DatasetFilters => {
    if (datasetId === null) return { ...DEFAULT_FILTERS };
    const saved = get().filtersByDataset[String(datasetId)];
    const pageSize =
      saved && isPageSize(saved.pageSize)
        ? saved.pageSize
        : DEFAULT_PAGE_SIZE;
    const cardSize = normalizeCardWidth(saved?.cardSize);
    return {
      ...DEFAULT_FILTERS,
      ...saved,
      // Страховка от старых сохранённых значений.
      quickFilter: saved?.quickFilter === "singles" ? "singles" : "all",
      pageSize,
      cardSize,
    };
  };

  /** Обновляет сохранённые настройки активного файла. */
  const withSavedFilters = (
    state: AppState,
    partial: Partial<DatasetFilters>,
  ): Record<string, DatasetFilters> => {
    if (state.activeDatasetId === null) return state.filtersByDataset;
    const key = String(state.activeDatasetId);
    return {
      ...state.filtersByDataset,
      [key]: {
        ...DEFAULT_FILTERS,
        ...state.filtersByDataset[key],
        ...partial,
      },
    };
  };

  /**
   * Возвращает группу товара в его собственную группу или в существующую
   * группу с тем же названием. Используется при отделении товара и удалении
   * группы.
   */
  const ensureOwnGroup = async (
    groups: Map<number, Group>,
    product: Product,
    keepGroupId: number,
  ): Promise<void> => {    const title = defaultGroupTitle(product);
    const titleKey = normalizeTitle(title);

    const existing = [...groups.values()].find(
      (group) =>
        group.id !== keepGroupId &&
        group.categoryId === product.categoryId &&
        group.titleKey === titleKey,
    );

    if (existing) {
      const next = groups.get(existing.id);
      if (next && !next.productIds.includes(product.id)) {
        groups.set(existing.id, {
          ...next,
          manual: true,
          productIds: sortProductIds(
            [...next.productIds, product.id],
            get().products,
          ),
        });
      }
    } else {
      const maxOrder = Math.max(0, ...[...groups.values()].map((g) => g.order));
      const maxNumber = Math.max(
        0,
        ...[...groups.values()].map((g) => g.number || 0),
      );
      const groupId = await addGroup({
        datasetId: get().activeDatasetId ?? 0,
        number: maxNumber + 1,
        title,
        titleRaw: product.goodsTitle,
        titleKey,
        titleSource: "derived",
        manual: true,
        categoryId: product.categoryId,
        categoryTitle: product.categoryTitle,
        productIds: [product.id],
        order: maxOrder + 1,
      });
      groups.set(groupId, {
        id: groupId,
        datasetId: get().activeDatasetId ?? 0,
        number: maxNumber + 1,
        title,
        titleRaw: product.goodsTitle,
        titleKey,
        titleSource: "derived",
        manual: true,
        categoryId: product.categoryId,
        categoryTitle: product.categoryTitle,
        productIds: [product.id],
        order: maxOrder + 1,
      });
    }
  };

  return {
    datasets: [],
    activeDatasetId: null,
    products: new Map(),
    groups: new Map(),
    orderedGroupIds: [],
    productToGroup: new Map(),

    search: "",
    categoryFilter: null,
    sortBy: "category",
    quickFilter: "all",
    filtersByDataset: {},
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    cardSize: DEFAULT_CARD_WIDTH,
    selectedGroupIds: new Set(),
    selectedProductIds: new Set(),
    mergeSuggestions: [],
    undoStack: [],
    isLoading: false,
    lastSavedAt: null,

    async init() {
      const datasets = await loadDatasets();
      set({ datasets });

      if (datasets.length === 0) return;
      const storedId = await getSetting<number>(ACTIVE_DATASET_KEY);
      const active =
        datasets.find((d) => d.id === storedId) ?? datasets[0];
      await get().switchDataset(active.id);
    },

    async importFile(fileName, text, onStage) {
      set({ isLoading: true });
      try {
        onStage?.("grouping");
        const {
          products: parsed,
          header,
          columnMap,
          groups: merged,
          autoMergedCount,
        } = await parseAndGroupCsv(text);

        // Номера групп задаются один раз при импорте — в порядке текущей
        // сортировки (категория, затем название). Дальше они не меняются.
        const numberByGroup = new Map(
          [...merged]
            .sort(
              (a, b) =>
                a.categoryTitle.localeCompare(b.categoryTitle, "uk") ||
                a.title.localeCompare(b.title, "uk"),
            )
            .map((group, index) => [group, index + 1]),
        );

        onStage?.("saving");
        const datasetId = await saveDataset(
          {
            name: fileName,
            importedAt: Date.now(),
            rowCount: parsed.length,
            groupCount: merged.length,
            autoMergedCount,
            columnMap,
            header,
          },
          parsed.map((product) => ({ ...product })),
          merged.map((group, index) => ({
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

        // Связываем товары с группами по порядку добавления.
        const productIdByOrder = new Map(
          datasetId.productIds.map((id, index) => [parsed[index].order, id]),
        );

        const linkedGroups: Group[] = merged.map((group, index) => ({
          id: datasetId.groupIds[index],
          datasetId: datasetId.datasetId,
          number: numberByGroup.get(group) ?? index + 1,
          title: group.title,
          titleRaw: group.titleRaw,
          titleKey: group.titleKey,
          titleSource: "derived",
          categoryId: group.categoryId,
          categoryTitle: group.categoryTitle,
          // memberIndexes уже отсортированы в порядке исходного файла.
          productIds: group.memberIndexes
            .map((memberIndex) => productIdByOrder.get(parsed[memberIndex].order))
            .filter((id): id is number => id !== undefined),
          order: index,
        }));

        await putGroups(linkedGroups);

        const [storedProducts, storedGroups] = await Promise.all([
          loadProducts(datasetId.datasetId),
          loadGroups(datasetId.datasetId),
        ]);
        const datasets = await loadDatasets();
        const groupsMap = new Map(storedGroups.map((g) => [g.id, g]));
        const filters: DatasetFilters = { ...DEFAULT_FILTERS };

        set({
          datasets,
          activeDatasetId: datasetId.datasetId,
          products: new Map(storedProducts.map((p) => [p.id, p])),
          groups: groupsMap,
          orderedGroupIds: orderGroupIds(groupsMap, filters.sortBy),
          productToGroup: buildProductToGroup(storedGroups),
          search: "",
          categoryFilter: filters.categoryFilter,
          quickFilter: filters.quickFilter,
          sortBy: filters.sortBy,
          page: 1,
          pageSize: filters.pageSize,
          cardSize: filters.cardSize,
          filtersByDataset: {
            ...get().filtersByDataset,
            [String(datasetId.datasetId)]: filters,
          },
          selectedGroupIds: new Set(),
          selectedProductIds: new Set(),
          mergeSuggestions: [],
          undoStack: [],
          lastSavedAt: Date.now(),
        });
        await setSetting(ACTIVE_DATASET_KEY, datasetId.datasetId);

        return { datasetId: datasetId.datasetId, autoMergedCount };
      } finally {
        set({ isLoading: false });
      }
    },

    async switchDataset(datasetId) {
      set({ isLoading: true });
      try {
        const [products, groups] = await Promise.all([
          loadProducts(datasetId),
          loadGroups(datasetId),
        ]);
        const { groups: numberedGroups, changed } =
          normalizeGroupNumbers(groups);
        if (changed.length > 0) await putGroups(changed);

        const groupsMap = new Map(numberedGroups.map((g) => [g.id, g]));
        const saved = getFiltersForDataset(datasetId);
        const availableCategories = new Set(
          numberedGroups.map((group) => group.categoryId),
        );
        const filters: DatasetFilters = {
          ...saved,
          // Если категория исчезла из файла, сбрасываем фильтр.
          categoryFilter:
            saved.categoryFilter !== null &&
            availableCategories.has(saved.categoryFilter)
              ? saved.categoryFilter
              : null,
        };

        set({
          activeDatasetId: datasetId,
          products: new Map(products.map((p) => [p.id, p])),
          groups: groupsMap,
          orderedGroupIds: orderGroupIds(groupsMap, filters.sortBy),
          productToGroup: buildProductToGroup(numberedGroups),
          search: "",
          categoryFilter: filters.categoryFilter,
          quickFilter: filters.quickFilter,
          sortBy: filters.sortBy,
          page: 1,
          pageSize: filters.pageSize,
          cardSize: filters.cardSize,
          filtersByDataset: {
            ...get().filtersByDataset,
            [String(datasetId)]: filters,
          },
          selectedGroupIds: new Set(),
          selectedProductIds: new Set(),
          mergeSuggestions: [],
          undoStack: [],
          lastSavedAt: Date.now(),
        });
        await setSetting(ACTIVE_DATASET_KEY, datasetId);
      } finally {
        set({ isLoading: false });
      }
    },

    async removeDataset(datasetId) {
      const state = get();
      const wasActive = state.activeDatasetId === datasetId;
      const datasets = state.datasets.filter(
        (dataset) => dataset.id !== datasetId,
      );
      const filtersByDataset = { ...state.filtersByDataset };
      delete filtersByDataset[String(datasetId)];

      // Файл исчезает из интерфейса сразу, а очистка IndexedDB идёт фоном.
      set({ datasets, filtersByDataset, undoStack: [], isLoading: true });

      try {
        if (wasActive) {
          if (datasets.length > 0) {
            await get().switchDataset(datasets[0].id);
          } else {
            set({
              activeDatasetId: null,
              products: new Map(),
              groups: new Map(),
              orderedGroupIds: [],
              productToGroup: new Map(),
              page: 1,
              pageSize: DEFAULT_PAGE_SIZE,
              cardSize: DEFAULT_CARD_WIDTH,
              selectedGroupIds: new Set(),
              selectedProductIds: new Set(),
              mergeSuggestions: [],
            });
          }
        }

        await dbDeleteDataset(datasetId);
      } finally {
        set({ isLoading: false });
      }
    },

    async renameDataset(datasetId, name) {
      const value = name.trim();
      if (!value) return false;
      await dbRenameDataset(datasetId, value);
      set((state) => ({
        datasets: state.datasets.map((dataset) =>
          dataset.id === datasetId ? { ...dataset, name: value } : dataset,
        ),
      }));
      return true;
    },

    setSearch(value) {
      set({ search: value, page: 1 });
    },

    setCategoryFilter(value) {
      set((state) => ({
        categoryFilter: value,
        page: 1,
        filtersByDataset: withSavedFilters(state, { categoryFilter: value }),
      }));
    },

    setSortBy(value) {
      set((state) => ({
        sortBy: value,
        page: 1,
        orderedGroupIds: orderGroupIds(state.groups, value),
        filtersByDataset: withSavedFilters(state, { sortBy: value }),
      }));
    },

    resort() {
      set({
        page: 1,
        orderedGroupIds: orderGroupIds(get().groups, get().sortBy),
      });
    },

    setQuickFilter(value) {
      set((state) => ({
        quickFilter: value,
        page: 1,
        filtersByDataset: withSavedFilters(state, { quickFilter: value }),
      }));
    },

    setPage(value) {
      set({ page: Math.max(1, Math.floor(value) || 1) });
    },

    setPageSize(value) {
      if (!isPageSize(value)) return;
      set((state) => ({
        pageSize: value,
        page: 1,
        filtersByDataset: withSavedFilters(state, { pageSize: value }),
      }));
    },

    setCardSize(value) {
      const cardSize = normalizeCardWidth(value);
      set((state) => ({
        cardSize,
        filtersByDataset: withSavedFilters(state, { cardSize }),
      }));
    },

    toggleGroupSelection(groupId) {
      const next = new Set(get().selectedGroupIds);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      set({ selectedGroupIds: next });
    },

    clearGroupSelection() {
      set({ selectedGroupIds: new Set() });
    },

    toggleProductSelection(productId) {
      const next = new Set(get().selectedProductIds);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      set({ selectedProductIds: next });
    },

    selectProducts(productIds) {
      if (productIds.length === 0) return;
      const next = new Set(get().selectedProductIds);
      for (const id of productIds) next.add(id);
      set({ selectedProductIds: next });
    },

    clearProductSelection() {
      set({ selectedProductIds: new Set() });
    },

    async renameGroup(groupId, newTitle) {
      const state = get();
      const group = state.groups.get(groupId);
      if (!group) return false;

      const title = newTitle.trim();
      if (!title) return false;

      const titleKey = normalizeTitle(title);
      const duplicates = [...state.groups.values()].filter(
        (candidate) =>
          candidate.id !== groupId &&
          candidate.categoryId === group.categoryId &&
          (candidate.titleKey || normalizeTitle(candidate.title)) === titleKey,
      );

      if (duplicates.length === 0) {
        if (group.title === title) return true;
        const next = new Map(state.groups);
        next.set(groupId, {
          ...group,
          title,
          titleKey,
          titleSource: "manual",
          manual: true,
        });
        await commit(state.groups, next, "Групу перейменовано");
        return true;
      }

      // Название совпало — объединяем дубли в переименованную группу.
      const next = new Map(state.groups);
      const movedIds = new Set(
        duplicates.flatMap((candidate) => candidate.productIds),
      );
      removeFromOtherGroups(next, movedIds, groupId);

      const target = next.get(groupId) ?? group;
      next.set(groupId, {
        ...target,
        title,
        titleKey,
        titleSource: "manual",
        manual: true,
        productIds: sortProductIds(
          [...target.productIds, ...movedIds],
          state.products,
        ),
      });

      for (const duplicate of duplicates) next.delete(duplicate.id);
      dropEmptiedGroups(next, state.groups, groupId);

      await commit(
        state.groups,
        next,
        duplicates.length === 1
          ? "Групи об’єднано"
          : "Кілька груп об’єднано",
      );
      return true;
    },

    async mergeGroups(groupIds, targetId) {
      const state = get();
      const target = state.groups.get(targetId);
      if (!target) return false;

      const sources = groupIds
        .filter((id) => id !== targetId)
        .map((id) => state.groups.get(id))
        .filter((group): group is Group => group !== undefined);

      if (sources.length === 0) return false;

      // Группы из разных категорий не объединяем.
      if (sources.some((group) => group.categoryId !== target.categoryId)) {
        return false;
      }

      const productIds = sortProductIds(
        [
          ...new Set([
            ...target.productIds,
            ...sources.flatMap((group) => group.productIds),
          ]),
        ],
        state.products,
      );

      const next = new Map(state.groups);
      next.set(targetId, { ...target, manual: true, productIds });
      for (const source of sources) next.delete(source.id);

      const selectedGroupIds = new Set(state.selectedGroupIds);
      for (const source of sources) selectedGroupIds.delete(source.id);
      set({ selectedGroupIds });

      await commit(
        state.groups,
        next,
        sources.length === 1 ? "Групи об’єднано" : "Кілька груп об’єднано",
      );
      return true;
    },

    async moveProduct(productId, toGroupId) {
      return get().moveProducts([productId], toGroupId);
    },

    async moveProducts(productIds, toGroupId) {
      const state = get();
      const target = state.groups.get(toGroupId);
      if (!target || productIds.length === 0) return false;

      const uniqueIds = [...new Set(productIds)];
      const products = uniqueIds
        .map((id) => state.products.get(id))
        .filter((product): product is Product => product !== undefined);
      if (products.length === 0) return false;

      // Товар нельзя переносить в группу другой категории.
      if (products.some((product) => product.categoryId !== target.categoryId)) {
        return false;
      }

      const idSet = new Set(products.map((product) => product.id));
      const affectedGroupIds = new Set<number>([toGroupId]);
      for (const product of products) {
        const sourceGroupId = state.productToGroup.get(product.id);
        if (sourceGroupId !== undefined) affectedGroupIds.add(sourceGroupId);
      }
      const next = new Map(state.groups);
      removeFromOtherGroups(next, idSet, toGroupId);

      const currentTarget = next.get(toGroupId) ?? target;
      next.set(toGroupId, {
        ...currentTarget,
        manual: true,
        productIds: sortProductIds(
          [
            ...currentTarget.productIds.filter((id) => !idSet.has(id)),
            ...idSet,
          ],
          state.products,
        ),
      });
      markManual(next, affectedGroupIds);

      dropEmptiedGroups(next, state.groups, toGroupId);
      refreshDerivedTitles(next, state.products, new Set([toGroupId]));
      await commit(state.groups, next, "Товари переміщено");
      return true;
    },

    async createGroupFromProduct(productId, title) {
      return get().createGroupFromProducts([productId], title);
    },

    async createGroupFromProducts(productIds, title) {
      const state = get();
      const uniqueIds = [...new Set(productIds)];
      const products = uniqueIds
        .map((id) => state.products.get(id))
        .filter((product): product is Product => product !== undefined)
        .sort((a, b) => a.order - b.order);
      if (products.length === 0) return null;

      const categoryId = products[0].categoryId;
      if (products.some((product) => product.categoryId !== categoryId)) {
        return null;
      }

      const next = new Map(state.groups);
      const idSet = new Set(uniqueIds);
      const affectedGroupIds = new Set<number>();
      for (const productId of uniqueIds) {
        const sourceGroupId = state.productToGroup.get(productId);
        if (sourceGroupId !== undefined) affectedGroupIds.add(sourceGroupId);
      }

      // Сначала забираем товары из старых групп. Если группа опустела,
      // она удалится, а её название освободится для новой группы.
      removeFromOtherGroups(next, idSet, -1);
      dropEmptiedGroups(next, state.groups);
      markManual(next, affectedGroupIds);
      refreshDerivedTitles(next, state.products);

      const baseTitle = title?.trim() || defaultGroupTitle(products[0]);
      const groupTitle = uniqueGroupTitle(next, categoryId, baseTitle);
      const titleKey = normalizeTitle(groupTitle);

      const maxOrder = Math.max(
        0,
        ...[...next.values()].map((group) => group.order),
      );
      const maxNumber = Math.max(
        0,
        ...[...next.values()].map((group) => group.number || 0),
      );

      const groupId = await addGroup({
        datasetId: state.activeDatasetId ?? 0,
        number: maxNumber + 1,
        title: groupTitle,
        titleRaw: products[0].goodsTitle,
        titleKey,
        titleSource: "derived",
        manual: true,
        categoryId,
        categoryTitle: products[0].categoryTitle,
        productIds: [],
        order: maxOrder + 1,
      });

      next.set(groupId, {
        id: groupId,
        datasetId: state.activeDatasetId ?? 0,
        number: maxNumber + 1,
        title: groupTitle,
        titleRaw: products[0].goodsTitle,
        titleKey,
        titleSource: "derived",
        manual: true,
        categoryId,
        categoryTitle: products[0].categoryTitle,
        productIds: sortProductIds(uniqueIds, state.products),
        order: maxOrder + 1,
      });

      await commit(state.groups, next, "Створено нову групу");

      // Показываем страницу, на которой оказалась новая группа.
      const updated = get();
      const index = updated.orderedGroupIds.indexOf(groupId);
      if (index !== -1) {
        set({ page: Math.floor(index / updated.pageSize) + 1 });
      }
      return groupId;
    },

    async removeProductFromGroup(productId) {
      const state = get();
      const groupId = state.productToGroup.get(productId);
      if (groupId === undefined) return;

      const group = state.groups.get(groupId);
      if (!group || group.productIds.length === 1) return;

      const product = state.products.get(productId);
      if (!product) return;

      const next = new Map(state.groups);
      const withoutProduct = group.productIds.filter((id) => id !== productId);
      next.set(groupId, { ...group, manual: true, productIds: withoutProduct });

      await ensureOwnGroup(next, product, groupId);
      dropEmptiedGroups(next, state.groups, groupId);
      refreshDerivedTitles(next, state.products);
      await commit(state.groups, next, "Товар винесено в окрему групу");
    },

    async detachProducts(productIds) {
      const state = get();
      const uniqueIds = [...new Set(productIds)];
      const next = new Map(state.groups);
      let changed = false;

      for (const productId of uniqueIds) {
        const groupId = state.productToGroup.get(productId);
        if (groupId === undefined) continue;
        const group = next.get(groupId);
        if (!group || group.productIds.length <= 1) continue;
        const product = state.products.get(productId);
        if (!product) continue;

        next.set(groupId, {
          ...group,
          manual: true,
          productIds: group.productIds.filter((id) => id !== productId),
        });
        await ensureOwnGroup(next, product, groupId);
        changed = true;
      }

      if (!changed) return false;

      dropEmptiedGroups(next, state.groups);
      refreshDerivedTitles(next, state.products);
      await commit(state.groups, next, "Товари винесено в окремі групи");
      return true;
    },

    async deleteGroup(groupId) {
      const state = get();
      const group = state.groups.get(groupId);
      if (!group) return;

      const next = new Map(state.groups);

      for (const productId of [...group.productIds]) {
        const product = state.products.get(productId);
        if (product) await ensureOwnGroup(next, product, groupId);
      }

      next.delete(groupId);
      dropEmptiedGroups(next, state.groups);

      const selectedGroupIds = new Set(state.selectedGroupIds);
      selectedGroupIds.delete(groupId);
      const selectedProductIds = new Set(state.selectedProductIds);
      for (const productId of group.productIds) {
        selectedProductIds.delete(productId);
      }
      set({ selectedGroupIds, selectedProductIds });

      await commit(state.groups, next, "Групу видалено");
    },

    async cleanTitlesWithLlm(onProgress) {
      const state = get();
      const datasetId = state.activeDatasetId;
      const candidates = [...state.groups.values()].filter(
        (group) =>
          group.titleSource !== "manual" &&
          !group.manual &&
          group.title.trim(),
      );
      const total = candidates.length;
      if (total === 0) {
        return {
          total: 0,
          cleaned: 0,
          merged: 0,
          modelMerged: 0,
          suggestions: [],
          failed: 0,
          jevSkipped: false,
          jevFailed: false,
          skipped: false,
        };
      }

      set({ isLoading: true });
      try {
        let status;
        try {
          status = await fetchCleanupStatus();
        } catch (error) {
          if (error instanceof LlmNotConfiguredError) {
            return {
              total,
              cleaned: 0,
              merged: 0,
              modelMerged: 0,
              suggestions: [],
              failed: 0,
              jevSkipped: true,
              jevFailed: false,
              skipped: true,
            };
          }
          throw error;
        }

        if (!status.configured) {
          return {
            total,
            cleaned: 0,
            merged: 0,
            modelMerged: 0,
            suggestions: [],
            failed: 0,
            jevSkipped: true,
            jevFailed: false,
            skipped: true,
          };
        }

        const inputs: CleanTitleInput[] = candidates.map((group) => {
          const first = state.products.get(group.productIds[0]);
          return {
            id: String(group.id),
            title: group.title,
            brand: first?.producersTitle || undefined,
            article: first?.goodsArticle || undefined,
            size: first?.size || undefined,
            color: first?.color || undefined,
            height: first?.height || undefined,
            category: group.categoryTitle || undefined,
          };
        });

        const results = new Map<string, CleanTitleResult>();
        const uncached: CleanTitleInput[] = [];
        for (const input of inputs) {
          const cached = await getLlmCache(
            cleanupCacheKey(input, status.model, status.promptVersion),
          );
          if (cached) {
            results.set(input.id, {
              id: input.id,
              title: cached.cleanedTitle,
              originalTitle: input.title,
              removed: cached.removed,
              confidence: cached.confidence,
            });
          } else {
            uncached.push(input);
          }
        }

        let processed = results.size;
        onProgress?.(processed, total);
        let failed = 0;

        const batches = chunkArray(uncached, 10);
        let batchIndex = 0;
        const runBatch = async () => {
          while (batchIndex < batches.length) {
            const batch = batches[batchIndex];
            batchIndex++;
            try {
              let data;
              try {
                data = await cleanTitlesBatch(batch);
              } catch (error) {
                if (
                  error instanceof LlmRequestError &&
                  (error.status === 429 || error.status >= 500)
                ) {
                  await new Promise((resolve) => setTimeout(resolve, 1200));
                  data = await cleanTitlesBatch(batch);
                } else {
                  throw error;
                }
              }
              for (const result of data.results) {
                results.set(result.id, result);
                const input = batch.find((item) => item.id === result.id);
                if (!input) continue;
                await putLlmCache({
                  key: cleanupCacheKey(input, status.model, status.promptVersion),
                  cleanedTitle: result.title,
                  removed: result.removed,
                  confidence: result.confidence,
                  model: status.model,
                  promptVersion: status.promptVersion,
                  createdAt: Date.now(),
                });
              }
            } catch (error) {
              if (error instanceof LlmNotConfiguredError) {
                return {
            total,
            cleaned: 0,
            merged: 0,
            modelMerged: 0,
            suggestions: [],
            failed: 0,
            jevSkipped: true,
            jevFailed: false,
            skipped: true,
          };
              }
              if (error instanceof LlmRequestError && error.status === 401) {
                throw error;
              }
              failed += batch.length;
            }

            processed += batch.length;
            onProgress?.(Math.min(processed, total), total);
          }
        };

        const workers = Array.from(
          { length: Math.min(4, batches.length) },
          () => runBatch(),
        );
        const workerResults = await Promise.all(workers);
        if (workerResults.some((result) => result?.skipped)) {
          return {
            total,
            cleaned: 0,
            merged: 0,
            modelMerged: 0,
            suggestions: [],
            failed: 0,
            jevSkipped: true,
            jevFailed: false,
            skipped: true,
          };
        }

        // Пока шли запросы, пользователь мог переключить или удалить файл.
        if (get().activeDatasetId !== datasetId) {
          return {
            total,
            cleaned: 0,
            merged: 0,
            modelMerged: 0,
            suggestions: [],
            failed: total,
            jevSkipped: false,
            jevFailed: false,
            skipped: false,
          };
        }

        let next = new Map(state.groups);
        let cleanedCount = 0;
        for (const group of candidates) {
          const result = results.get(String(group.id));
          const title = result?.title.trim();
          if (!title || title === group.title) continue;
          next.set(group.id, {
            ...group,
            title,
            titleKey: normalizeTitle(title),
            titleSource: "llm",
          });
          cleanedCount++;
        }

        // После очистки названия могут совпасть — сливаем автоматические группы.
        const buckets = new Map<string, Group[]>();
        for (const group of next.values()) {
          if (group.titleSource === "manual" || group.manual) continue;
          const key = `${group.categoryId}\u0000${group.titleKey}`;
          const bucket = buckets.get(key);
          if (bucket) bucket.push(group);
          else buckets.set(key, [group]);
        }

        let merged = 0;
        for (const bucket of buckets.values()) {
          if (bucket.length < 2) continue;
          bucket.sort((a, b) => a.number - b.number);
          const target = bucket[0];
          const productIds = sortProductIds(
            [...new Set(bucket.flatMap((group) => group.productIds))],
            state.products,
          );
          next.set(target.id, { ...target, productIds });
          for (const source of bucket.slice(1)) {
            next.delete(source.id);
            merged++;
          }
        }

        // Второй слой: Jev проверяет пары групп, у которых разные названия,
        // но которые могут быть вариантами одной модели.
        let modelMerged = 0;
        let suggestions: MergeSuggestion[] = [];
        let jevSkipped = false;
        let jevFailed = false;

        try {
          const jevStatus = await fetchJevStatus();
          if (!jevStatus.configured) {
            jevSkipped = true;
          } else {
            const candidatePairs = generateCandidatePairs(
              next.values(),
              state.products,
            );
            const jevPairs = buildJevPairs(next, state.products, candidatePairs);

            if (jevPairs.length > 0) {
              const jevBatches = chunkArray(jevPairs, 20);
              const decisions: JevPairResult[] = [];
              let jevBatchIndex = 0;

              const runJevBatch = async () => {
                while (jevBatchIndex < jevBatches.length) {
                  const batch = jevBatches[jevBatchIndex];
                  jevBatchIndex++;
                  try {
                    let data;
                    try {
                      data = await matchPairsBatch(batch);
                    } catch (error) {
                      if (
                        error instanceof JevRequestError &&
                        (error.status === 429 || error.status >= 500)
                      ) {
                        await new Promise((resolve) => setTimeout(resolve, 1200));
                        data = await matchPairsBatch(batch);
                      } else {
                        throw error;
                      }
                    }
                    decisions.push(...data.results);
                  } catch (error) {
                    if (error instanceof JevNotConfiguredError) {
                      jevSkipped = true;
                      return;
                    }
                    if (error instanceof JevRequestError && error.status === 401) {
                      throw error;
                    }
                    jevFailed = true;
                  }
                }
              };

              const jevWorkers = Array.from(
                { length: Math.min(3, jevBatches.length) },
                () => runJevBatch(),
              );
              await Promise.all(jevWorkers);

              if (get().activeDatasetId !== datasetId) {
                return {
                  total,
                  cleaned: 0,
                  merged: 0,
                  modelMerged: 0,
                  suggestions: [],
                  failed: total,
                  jevSkipped,
                  jevFailed,
                  skipped: false,
                };
              }

              if (decisions.length > 0) {
                const applied = applyJevDecisions(
                  next,
                  decisions,
                  state.products,
                );
                next = applied.groups;
                modelMerged = applied.merged;
                suggestions = applied.suggestions;
              }
            }
          }
        } catch (error) {
          if (error instanceof JevRequestError && error.status === 401) {
            throw error;
          }
          if (error instanceof JevNotConfiguredError) {
            jevSkipped = true;
          } else {
            jevFailed = true;
          }
        }

        if (cleanedCount > 0 || merged > 0 || modelMerged > 0) {
          await commit(
            state.groups,
            next,
            modelMerged > 0
              ? "Назви очищено, групи об’єднано за моделлю"
              : "Назви очищено ШІ",
          );
        }
        set({ mergeSuggestions: suggestions });

        return {
          total,
          cleaned: cleanedCount,
          merged,
          modelMerged,
          suggestions,
          failed,
          jevSkipped,
          jevFailed,
          skipped: false,
        };
      } finally {
        set({ isLoading: false });
      }
    },

    async resetGroupTitle(groupId) {
      const state = get();
      const group = state.groups.get(groupId);
      if (!group) return false;
      const title = group.titleRaw.trim();
      if (!title) return false;

      const titleKey = normalizeTitle(title);
      const next = new Map(state.groups);
      next.set(groupId, {
        ...group,
        title,
        titleKey,
        titleSource: "derived",
        manual: true,
      });

      const duplicates = [...next.values()].filter(
        (candidate) =>
          candidate.id !== groupId &&
          candidate.categoryId === group.categoryId &&
          candidate.titleKey === titleKey &&
          candidate.titleSource !== "manual",
      );
      if (duplicates.length > 0) {
        const removedIds = new Set(
          duplicates.flatMap((duplicate) => duplicate.productIds),
        );
        removeFromOtherGroups(next, removedIds, groupId);
        const target = next.get(groupId) ?? group;
        next.set(groupId, {
          ...target,
          title,
          titleKey,
          titleSource: "derived",
          manual: true,
          productIds: sortProductIds(
            [...target.productIds, ...removedIds],
            state.products,
          ),
        });
        for (const duplicate of duplicates) next.delete(duplicate.id);
        dropEmptiedGroups(next, state.groups, groupId);
      }

      await commit(state.groups, next, "Назву групи відновлено");
      return true;
    },

    async applyMergeSuggestion(aId, bId) {
      const state = get();
      const a = state.groups.get(aId);
      const b = state.groups.get(bId);
      if (!a || !b || a.id === b.id) return false;

      const [target, source] =
        a.number <= b.number ? [a, b] : [b, a];
      const ok = await get().mergeGroups([source.id], target.id);
      if (!ok) return false;

      set({
        mergeSuggestions: get().mergeSuggestions.filter(
          (suggestion) =>
            !(
              (suggestion.aId === aId && suggestion.bId === bId) ||
              (suggestion.aId === bId && suggestion.bId === aId)
            ),
        ),
      });
      return true;
    },

    dismissMergeSuggestion(aId, bId) {
      set({
        mergeSuggestions: get().mergeSuggestions.filter(
          (suggestion) =>
            !(
              (suggestion.aId === aId && suggestion.bId === bId) ||
              (suggestion.aId === bId && suggestion.bId === aId)
            ),
        ),
      });
    },

    clearMergeSuggestions() {
      set({ mergeSuggestions: [] });
    },

    async undo() {
      const state = get();
      const entry = state.undoStack[state.undoStack.length - 1];
      if (!entry) return false;

      const restored = new Map(entry.groups.map((group) => [group.id, group]));
      await persistDiff(state.groups, restored);

      const datasetId = state.activeDatasetId;
      const datasets =
        datasetId === null
          ? state.datasets
          : state.datasets.map((dataset) =>
              dataset.id === datasetId
                ? { ...dataset, groupCount: restored.size }
                : dataset,
            );

      set({
        groups: restored,
        orderedGroupIds: buildStableOrder(
          entry.orderedGroupIds,
          restored,
          state.sortBy,
        ),
        productToGroup: buildProductToGroup([...restored.values()]),
        datasets,
        undoStack: state.undoStack.slice(0, -1),
        selectedGroupIds: new Set(),
        selectedProductIds: new Set(),
        lastSavedAt: Date.now(),
      });

      if (datasetId !== null) {
        await updateDatasetCounts(datasetId, restored.size);
      }
      return true;
    },
      };
    },
    {
      name: "ccc-filters-v1",
      version: 1,
      storage: filterStorage,
      partialize: (state) => ({ filtersByDataset: state.filtersByDataset }),
    },
  ),
);

/* ───────────────  Селекторы  ─────────────── */

/** Сравнение групп для выбранного режима сортировки. */
function compareGroups(a: Group, b: Group, sortBy: SortBy): number {
  switch (sortBy) {
    case "title":
      return a.title.localeCompare(b.title, "uk");
    case "count":
      return b.productIds.length - a.productIds.length;
    case "category":
      return (
        a.categoryTitle.localeCompare(b.categoryTitle, "uk") ||
        a.title.localeCompare(b.title, "uk")
      );
    default:
      return a.order - b.order;
  }
}

/** Полный порядок групп по выбранной сортировке. */
function orderGroupIds(
  groups: Map<number, Group>,
  sortBy: SortBy,
): number[] {
  return [...groups.values()]
    .sort((a, b) => compareGroups(a, b, sortBy))
    .map((group) => group.id);
}

/**
 * Сохраняет прежний порядок уже показанных групп и вставляет новые группы
 * на место по текущей сортировке. Благодаря этому переименование не двигает
 * группу, а созданная группа не оказывается в случайном месте.
 */
function buildStableOrder(
  previousIds: number[],
  groups: Map<number, Group>,
  sortBy: SortBy,
): number[] {
  const ordered: number[] = [];
  const used = new Set<number>();

  for (const id of previousIds) {
    if (!groups.has(id) || used.has(id)) continue;
    ordered.push(id);
    used.add(id);
  }

  const newGroups = [...groups.values()]
    .filter((group) => !used.has(group.id))
    .sort((a, b) => compareGroups(a, b, sortBy));

  for (const group of newGroups) {
    let index = ordered.length;
    for (let i = 0; i < ordered.length; i++) {
      const existing = groups.get(ordered[i]);
      if (existing && compareGroups(group, existing, sortBy) < 0) {
        index = i;
        break;
      }
    }
    ordered.splice(index, 0, group.id);
  }

  return ordered;
}

/**
 * Отсортированные и отфильтрованные группы активного датасета.
 *
 * Селекторы берут из стора только стабильные ссылки (Map, строки), а
 * производные данные считаются в useMemo. Если отдавать наружу новые
 * объекты/массивы, `useSyncExternalStore` будет считать снимок изменившимся
 * на каждом рендере и уйдёт в бесконечный цикл.
 *
 * Порядок групп «замораживается» между изменениями данных: если
 * переименовать группу, она не перескочит на новое место в отсортированном
 * списке. Полная пересортировка происходит при смене режима сортировки,
 * загрузке/смене файла или по кнопке «Пересортировать».
 */
export function useVisibleGroups(): Group[] {
  const groups = useAppStore((s) => s.groups);
  const products = useAppStore((s) => s.products);
  const orderedGroupIds = useAppStore((s) => s.orderedGroupIds);
  const sortBy = useAppStore((s) => s.sortBy);
  const search = useAppStore((s) => s.search);
  const categoryFilter = useAppStore((s) => s.categoryFilter);
  const quickFilter = useAppStore((s) => s.quickFilter);

  return useMemo(() => {
    const orderComplete =
      orderedGroupIds.length === groups.size &&
      orderedGroupIds.every((id) => groups.has(id));
    const order = orderComplete
      ? orderedGroupIds
      : buildStableOrder(orderedGroupIds, groups, sortBy);

    const query = search.trim().toLowerCase();

    return order
      .map((id) => groups.get(id))
      .filter((group): group is Group => group !== undefined)
      .filter((group) => {
        if (categoryFilter !== null && group.categoryId !== categoryFilter) {
          return false;
        }

        switch (quickFilter) {
          case "singles":
            if (group.productIds.length !== 1) return false;
            break;
        }

        if (!query) return true;
        if (group.title.toLowerCase().includes(query)) return true;
        if (String(group.number).includes(query)) return true;
        return group.productIds.some((id) => {
          const product = products.get(id);
          if (!product) return false;
          return (
            product.goodsTitle.toLowerCase().includes(query) ||
            product.goodsArticle.toLowerCase().includes(query) ||
            product.goodsId.toLowerCase().includes(query)
          );
        });
      });
  }, [
    groups,
    products,
    orderedGroupIds,
    sortBy,
    search,
    categoryFilter,
    quickFilter,
  ]);
}

/** Товары группы в порядке исходного файла. */
export function useGroupProducts(group: Group | undefined): Product[] {
  const products = useAppStore((s) => s.products);
  const productIds = group?.productIds;

  return useMemo(() => {
    if (!productIds) return [];
    return productIds
      .map((id) => products.get(id))
      .filter((p): p is Product => p !== undefined)
      .sort((a, b) => a.order - b.order);
  }, [products, productIds]);
}

/** Выбранные товары в порядке исходного файла. */
export function useSelectedProducts(): Product[] {
  const products = useAppStore((s) => s.products);
  const selectedProductIds = useAppStore((s) => s.selectedProductIds);

  return useMemo(
    () =>
      [...selectedProductIds]
        .map((id) => products.get(id))
        .filter((p): p is Product => p !== undefined)
        .sort((a, b) => a.order - b.order),
    [products, selectedProductIds],
  );
}

/** Список категорий с количеством групп. */
export function useCategories() {
  const groups = useAppStore((s) => s.groups);

  return useMemo(() => {
    const map = new Map<
      string,
      { id: string; title: string; count: number }
    >();
    for (const group of groups.values()) {
      const existing = map.get(group.categoryId);
      if (existing) existing.count++;
      else
        map.set(group.categoryId, {
          id: group.categoryId,
          title: group.categoryTitle || "Без категорії",
          count: 1,
        });
    }
    return [...map.values()].sort((a, b) =>
      a.title.localeCompare(b.title, "uk"),
    );
  }, [groups]);
}

/** Счётчики для тулбара. */
export function useCounters() {
  const products = useAppStore((s) => s.products);
  const groups = useAppStore((s) => s.groups);

  return useMemo(() => {
    const groupList = [...groups.values()];
    return {
      products: products.size,
      groups: groupList.length,
      singles: groupList.filter((g) => g.productIds.length === 1).length,
      productsWithoutPhotos: [...products.values()].filter(
        (p) => p.imageUrls.length === 0,
      ).length,
    };
  }, [products, groups]);
}
