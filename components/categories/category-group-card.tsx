"use client";

import { memo, useCallback, useMemo } from "react";

import { ProductCard } from "@/components/groups/product-card";
import { clusterCategories } from "@/lib/store/category-store";
import type { CategoryCluster, Product } from "@/lib/types";

/**
 * Карточка группы в потоке категорий.
 *
 * Использует тот же ProductCard, что и обычная группировка, но в режиме
 * группы: выбор относится к группе, а клик открывает её товары.
 */
export const CategoryGroupCard = memo(function CategoryGroupCard({
  cluster,
  products,
  selected,
  linkedCount,
  onToggleSelect,
  onOpen,
}: {
  cluster: CategoryCluster;
  products: Map<number, Product>;
  selected: boolean;
  linkedCount: number;
  onToggleSelect: (clusterId: number) => void;
  onOpen: (clusterId: number) => void;
}) {
  const members = useMemo(
    () =>
      cluster.productIds
        .map((id) => products.get(id))
        .filter((product): product is Product => product !== undefined)
        .sort((a, b) => a.order - b.order),
    [cluster.productIds, products],
  );
  const categories = useMemo(
    () => clusterCategories(cluster, products),
    [cluster, products],
  );
  const first = members[0];
  const handleSelect = useCallback(
    () => onToggleSelect(cluster.id),
    [onToggleSelect, cluster.id],
  );
  const handleOpen = useCallback(
    () => onOpen(cluster.id),
    [onOpen, cluster.id],
  );

  if (!first) return null;

  return (
    <ProductCard
      product={first}
      mode="group"
      selected={selected}
      onSelectionChange={handleSelect}
      onOpenGroup={handleOpen}
      groupCount={members.length}
      groupCategories={categories}
      groupMixed={categories.length > 1}
      groupLinkedCount={linkedCount}
      groupTransferred={
        cluster.targetCategoryId != null &&
        members.some(
          (product) =>
            (product.originalCategoryId ?? product.categoryId) !==
            cluster.targetCategoryId,
        )
      }
    />
  );
});
