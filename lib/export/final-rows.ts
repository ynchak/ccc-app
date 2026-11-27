import type { Group, Product } from "@/lib/types";

/** Строка финального экспорта после потока категорий. */
export interface FinalExportRow {
  id: string;
  goodsTitle: string;
  goodsTitleUk?: string;
  categoryTitle: string;
  categoryId: string;
  groupTitle: string;
}

/**
 * Формирует финальный файл: товар, его категория и название группы.
 * Сортировка — по группе, затем по категории, внутри — исходный порядок.
 */
export function buildFinalExportRows(
  products: Product[],
  groups: Group[],
  productToGroup: Map<number, number>,
): FinalExportRow[] {
  const groupById = new Map(groups.map((group) => [group.id, group]));

  return [...products]
    .map((product) => {
      const groupId = productToGroup.get(product.id);
      const group = groupId !== undefined ? groupById.get(groupId) : undefined;
      return {
        id: product.goodsId,
        goodsTitle: product.goodsTitle,
        goodsTitleUk: product.goodsTitleUk,
        categoryTitle: product.categoryTitle,
        categoryId: product.categoryId,
        groupTitle: group?.title ?? "",
        order: product.order,
      };
    })
    .sort((a, b) => {
      if (a.groupTitle !== b.groupTitle) {
        if (!a.groupTitle) return 1;
        if (!b.groupTitle) return -1;
        return a.groupTitle.localeCompare(b.groupTitle, "uk");
      }
      if (a.categoryTitle !== b.categoryTitle) {
        return a.categoryTitle.localeCompare(b.categoryTitle, "uk");
      }
      return a.order - b.order;
    })
    .map((row) => {
      const { order, ...rest } = row;
      void order;
      return rest;
    });
}
