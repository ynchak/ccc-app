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

/**
 * Полный разбор CSV и группировка. Чистая функция без DOM и IndexedDB,
 * поэтому может выполняться в Web Worker.
 */
export function groupCsvText(text: string): GroupedCsv {
  const { products, header, columnMap, skippedRows } = parseCsv(text);

  if (products.length === 0) {
    throw new Error(
      "В файле не найдено ни одного товара. Проверьте заголовки и колонки goods_id.",
    );
  }

  const { groups, mergedCount } = mergeByTitle(
    toGroups(clusterByPhotos(products), products),
    products,
  );

  return {
    products,
    header,
    columnMap,
    skippedRows,
    groups,
    autoMergedCount: mergedCount,
  };
}
