import { parseCsv } from "@/lib/csv/parse";
import { clusterByPhotos, defaultGroupTitle } from "@/lib/grouping/cluster";
import type { ColumnMapping, ParsedProduct } from "@/lib/types";

/** Кластер, подготовленный для записи в IndexedDB. */
export interface ParsedCategoryCluster {
  /** Индексы товаров в массиве products. */
  memberIndexes: number[];
  title: string;
  /** Название кластера на українській (из goods_title_uk первого товара). */
  titleUk?: string;
  order: number;
  number: number;
}

/** Результат разбора CSV для потока разнесения по категориям. */
export interface ParsedCategoryCsv {
  products: ParsedProduct[];
  header: string[];
  columnMap: ColumnMapping[];
  skippedRows: number;
  clusters: ParsedCategoryCluster[];
}

/**
 * Разбирает CSV и группирует товары по фото без ограничения категорией.
 *
 * Категория на этом этапе не граница: одинаковые модели нужно найти даже
 * тогда, когда в файле они лежат в разных категориях.
 */
export function parseCategoryCsvText(text: string): ParsedCategoryCsv {
  const { products, header, columnMap, skippedRows } = parseCsv(text);

  if (products.length === 0) {
    throw new Error(
      "У файлі не знайдено жодного товару. Перевірте заголовки та колонки goods_id.",
    );
  }

  // Исходная категория не меняется на протяжении всего потока.
  const productsWithOrigin = products.map((product) => ({
    ...product,
    originalCategoryId: product.categoryId,
    originalCategoryTitle: product.categoryTitle,
  }));

  const clusters = clusterByPhotos(productsWithOrigin, {
    acrossCategories: true,
  }).map((cluster, index) => {
    const first = productsWithOrigin[cluster.memberIndexes[0]];
    return {
      memberIndexes: cluster.memberIndexes,
      title: defaultGroupTitle(first),
      titleUk: first.goodsTitleUk || undefined,
      order: index,
      number: index + 1,
    };
  });

  return {
    products: productsWithOrigin,
    header,
    columnMap,
    skippedRows,
    clusters,
  };
}
