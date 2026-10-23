import type { Group, Product } from "@/lib/types";

/**
 * Формирование строк экспорта.
 *
 * XLSX для сервиса группировки: `id`, `Название`, `Категория`, `Группа`.
 * Порядок строк совпадает с исходным файлом.
 */

/** Строка экспорта. */
export interface ExportRow {
  id: string;
  goodsTitle: string;
  categoryTitle: string;
  groupTitle: string;
}

/**
 * Формирует строки экспорта: товары в порядке исходного файла,
 * с названием группы каждого товара.
 */
export function buildExportRows(
  products: Product[],
  groups: Group[],
  productToGroup: Map<number, number>,
): ExportRow[] {
  const groupById = new Map(groups.map((g) => [g.id, g]));

  return [...products]
    .sort((a, b) => a.order - b.order)
    .map((product) => {
      const groupId = productToGroup.get(product.id);
      const group = groupId !== undefined ? groupById.get(groupId) : undefined;
      return {
        id: product.goodsId,
        goodsTitle: product.goodsTitle,
        categoryTitle: product.categoryTitle,
        groupTitle: group?.title ?? "",
      };
    });
}
