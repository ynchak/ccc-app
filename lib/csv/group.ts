import { parseCsv } from "@/lib/csv/parse";
import {
  clusterByPhotos,
  toGroups,
  type ClusteredGroup,
} from "@/lib/grouping/cluster";
import { mergeByTitle } from "@/lib/grouping/merge";
import type { ColumnMapping, ParsedProduct } from "@/lib/types";

/** Результат разбора и группировки CSV. */
export interface GroupedCsv {
  products: ParsedProduct[];
  header: string[];
  columnMap: ColumnMapping[];
  skippedRows: number;
  groups: ClusteredGroup[];
  autoMergedCount: number;
}

/** Группирует уже разобранные товары внутри их категорий. */
export function groupProducts(products: ParsedProduct[]): {
  groups: ClusteredGroup[];
  autoMergedCount: number;
} {
  const { groups, mergedCount } = mergeByTitle(
    toGroups(clusterByPhotos(products), products),
    products,
  );
  return { groups, autoMergedCount: mergedCount };
}

/**
 * Полный разбор CSV и группировка. Чистая функция без DOM и IndexedDB,
 * поэтому может выполняться в Web Worker.
 */
export function groupCsvText(text: string): GroupedCsv {
  const { products, header, columnMap, skippedRows } = parseCsv(text);

  if (products.length === 0) {
    throw new Error(
      "У файлі не знайдено жодного товару. Перевірте заголовки та колонки goods_id.",
    );
  }

  const { groups, autoMergedCount } = groupProducts(products);

  return {
    products,
    header,
    columnMap,
    skippedRows,
    groups,
    autoMergedCount,
  };
}
