"use client";

import { create } from "zustand";

/** Чистое интерфейсное состояние, независимое от данных товаров/групп. */
interface UIState {
  search: string;
  selectedGroupIds: Set<number>;
  selectedProductIds: Set<number>;
  /** Свернутость групп по датасетам: datasetId -> groupId -> isExpanded. */
  groupExpandedByDataset: Record<number, Record<number, boolean>>;

  setSearch: (value: string) => void;
  toggleGroupExpanded: (datasetId: number | null, groupId: number) => void;
  toggleGroupSelection: (groupId: number) => void;
  clearGroupSelection: () => void;
  toggleProductSelection: (productId: number) => void;
  selectProducts: (productIds: number[]) => void;
  clearProductSelection: () => void;
}

export const useUIStore = create<UIState>()(
  (set, get) => ({
    search: "",
    selectedGroupIds: new Set(),
    selectedProductIds: new Set(),
    groupExpandedByDataset: {},

    setSearch(value) {
      set({ search: value });
    },

    toggleGroupExpanded(datasetId: number | null, groupId: number) {
      if (datasetId === null) return;
      set((state) => {
        const byDataset = state.groupExpandedByDataset[datasetId] ?? {};
        const nextByDataset = { ...byDataset };
        nextByDataset[groupId] = !byDataset[groupId];
        return {
          groupExpandedByDataset: {
            ...state.groupExpandedByDataset,
            [datasetId]: nextByDataset,
          },
        };
      });
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
  }),
);

/* ───────────────  Селекторы  ─────────────── */

/** Фильтры и настройки отображения остаются в appStore, а здесь — только Pure UI. */
export function useUISearch() {
  return useUIStore((s) => s.search);
}

export function useUIGroupExpanded(datasetId: number | null, groupId: number) {
  return useUIStore((s) => {
    if (datasetId === null) return true;
    return s.groupExpandedByDataset[datasetId]?.[groupId] ?? true;
  });
}

export function useUIGroupSelection(groupId: number) {
  return useUIStore((s) => s.selectedGroupIds.has(groupId));
}

export function useUIProductSelection(productId: number) {
  return useUIStore((s) => s.selectedProductIds.has(productId));
}

export function useUIToggleGroupExpanded() {
  return useUIStore((s) => s.toggleGroupExpanded);
}

export function useUIToggleGroupSelection() {
  return useUIStore((s) => s.toggleGroupSelection);
}

export function useUIClearGroupSelection() {
  return useUIStore((s) => s.clearGroupSelection);
}

export function useUIToggleProductSelection() {
  return useUIStore((s) => s.toggleProductSelection);
}

export function useUISelectProducts() {
  return useUIStore((s) => s.selectProducts);
}

export function useUIClearProductSelection() {
  return useUIStore((s) => s.clearProductSelection);
}

export function useUISetSearch() {
  return useUIStore((s) => s.setSearch);
}
