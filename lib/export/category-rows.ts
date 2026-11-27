import type { CategoryCluster, Product } from "@/lib/types";

/** Строка экспорта изменённых категорий. */
export interface CategoryExportRow {
  id: string;
  goodsTitle: string;
  goodsTitleUk?: string;
  categoryTitle: string;
  categoryId: string;
  /** Название изменилось относительно оригинала из CSV. */
  titleChanged: boolean;
}

/**
 * Формирует строки для товаров, у которых изменилась целевая категория
 * или название. Порядок — как в исходном файле.
 */
export function buildCategoryChangeRows(
  products: Iterable<Product>,
  clusters: Iterable<CategoryCluster>,
): CategoryExportRow[] {
  const clusterByProduct = new Map<number, CategoryCluster>();
  for (const cluster of clusters) {
    for (const productId of cluster.productIds) {
      clusterByProduct.set(productId, cluster);
    }
  }

  return [...products]
    .sort((a, b) => a.order - b.order)
    .flatMap((product) => {
      const cluster = clusterByProduct.get(product.id);
      const originalId = product.originalCategoryId ?? product.categoryId;
      const categoryChanged =
        cluster?.targetCategoryId &&
        originalId !== cluster.targetCategoryId;
      const titleChanged =
        product.goodsTitle !== (product.originalGoodsTitle ?? product.goodsTitle) ||
        product.goodsTitleUk !== (product.originalGoodsTitleUk ?? product.goodsTitleUk);

      if (!categoryChanged && !titleChanged) return [];

      return [
        {
          id: product.goodsId,
          goodsTitle: product.goodsTitle,
          goodsTitleUk: product.goodsTitleUk,
          categoryTitle:
            cluster?.targetCategoryTitle ||
            product.categoryTitle ||
            "Без категорії",
          categoryId: cluster?.targetCategoryId ?? originalId,
          titleChanged,
        },
      ];
    });
}
