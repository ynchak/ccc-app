import type { CategoryCluster, Product } from "@/lib/types";

/** Строка экспорта изменённых категорий. */
export interface CategoryExportRow {
  id: string;
  goodsTitle: string;
  goodsTitleUk?: string;
  categoryTitle: string;
  categoryId: string;
}

/**
 * Формирует строки только для товаров, у которых целевая категория
 * отличается от исходной. Порядок — как в исходном файле.
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
      if (!cluster?.targetCategoryId) return [];
      const originalId = product.originalCategoryId ?? product.categoryId;
      if (originalId === cluster.targetCategoryId) return [];
      return [
        {
          id: product.goodsId,
          goodsTitle: product.goodsTitle,
          goodsTitleUk: product.goodsTitleUk,
          categoryTitle:
            cluster.targetCategoryTitle ||
            product.categoryTitle ||
            "Без категорії",
          categoryId: cluster.targetCategoryId,
        },
      ];
    });
}
