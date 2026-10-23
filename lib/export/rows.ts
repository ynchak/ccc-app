import type { Group, Product } from "@/lib/types";

/**
 * Формирование строк экспорта.
 *
 * XLSX для сервиса группировки: `id`, `Название`, `Категория`, `Группа`.
 * Строки сортируются по группе, затем по категории; внутри группы
 * сохраняется исходный порядок товаров.
 */

/** Строка экспорта. */
export interface ExportRow {
  id: string;
  goodsTitle: string;
  categoryTitle: string;
  groupTitle: string;
  /** Цвет, добавленный сервисом; исходные цвета не экспортируются. */
  suggestedColor: string;
}

/**
 * Формирует строки экспорта, сортируя их по названию группы.
 *
 * Внутри группы товары идут в исходном порядке файла. Товары без группы
 * оказываются в конце. Категория используется как вторичный ключ, чтобы
 * одинаковые названия групп из разных категорий не перемешивались.
 */
export function buildExportRows(
  products: Product[],
  groups: Group[],
  productToGroup: Map<number, number>,
): ExportRow[] {
  const groupById = new Map(groups.map((g) => [g.id, g]));

  return [...products]
    .map((product) => {
      const groupId = productToGroup.get(product.id);
      const group = groupId !== undefined ? groupById.get(groupId) : undefined;
      return {
        id: product.goodsId,
        goodsTitle: product.goodsTitle,
        categoryTitle: product.categoryTitle,
        groupTitle: group?.title ?? "",
        suggestedColor:
          product.colorSource === "suggested" ? (product.color ?? "") : "",
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
    .map((row) => ({
      id: row.id,
      goodsTitle: row.goodsTitle,
      categoryTitle: row.categoryTitle,
      groupTitle: row.groupTitle,
      suggestedColor: row.suggestedColor,
    }));
}
