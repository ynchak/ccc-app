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
  /** Цвет товара (из поля color). */
  color: string | null;
  /** Цвет изменился относительно оригинала из CSV. */
  colorChanged: boolean;
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
      const colorChanged =
        product.color !== (product.originalColor ?? null);

      if (!categoryChanged && !titleChanged && !colorChanged) return [];

      return [
        {
          id: product.goodsId,
          goodsTitle: product.goodsTitle,
          goodsTitleUk: product.goodsTitleUk,
          categoryTitle: categoryChanged
            ? (cluster?.targetCategoryTitle ||
                product.categoryTitle ||
                "Без категорії")
            : "",
          categoryId: categoryChanged
            ? cluster?.targetCategoryId ?? originalId
            : "",
          titleChanged,
          color: colorChanged ? product.color : null,
          colorChanged,
        },
      ];
    });
}
