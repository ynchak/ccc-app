"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { PageSize } from "@/lib/pagination";

/** Количество категорий на странице по умолчанию. */
export const CATEGORY_PAGE_SIZE_DEFAULT: PageSize = 25;

/** Сохраняемое состояние экрана категорий для одного файла. */
export interface CategoryViewState {
  collapsedSections: string[];
  categoryFilter: string | null;
  search: string;
  scrollTop: number;
  visibleLimits: Record<string, number>;
  groupPages: Record<string, number>;
  groupPageSizes: Record<string, PageSize>;
  page: number;
  pageSize: PageSize;
}

const DEFAULT_VIEW: CategoryViewState = {
  collapsedSections: [],
  categoryFilter: null,
  search: "",
  scrollTop: 0,
  visibleLimits: {},
  groupPages: {},
  groupPageSizes: {},
  page: 1,
  pageSize: CATEGORY_PAGE_SIZE_DEFAULT,
};

const viewStorage = createJSONStorage<Pick<CategoryViewStore, "views">>(
  () =>
    typeof window !== "undefined"
      ? window.localStorage
      : {
          getItem: () => null,
          setItem: () => undefined,
          removeItem: () => undefined,
        },
);

interface CategoryViewStore {
  views: Record<string, CategoryViewState>;
  updateView: (
    datasetId: string,
    partial: Partial<CategoryViewState>,
  ) => void;
}

export const useCategoryViewStore = create<CategoryViewStore>()(
  persist(
    (set) => ({
      views: {},
      updateView(datasetId, partial) {
        set((state) => ({
          views: {
            ...state.views,
            [datasetId]: {
              ...DEFAULT_VIEW,
              ...state.views[datasetId],
              ...partial,
            },
          },
        }));
      },
    }),
    {
      name: "ccc-category-views-v1",
      version: 1,
      storage: viewStorage,
      partialize: (state) => ({ views: state.views }),
    },
  ),
);

/** Настройки экрана для конкретного файла. */
export function useCategoryView(datasetId: number | null): CategoryViewState {
  const key = String(datasetId ?? "none");
  const view = useCategoryViewStore((state) => state.views[key]);
  return view ? { ...DEFAULT_VIEW, ...view } : DEFAULT_VIEW;
}
