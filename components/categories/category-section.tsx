"use client";

import { memo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";

import { CategoryGroupCard } from "@/components/categories/category-group-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cardGridStyle, type CardWidth } from "@/lib/card-size";
import type { ModelLink } from "@/lib/category/links";
import { groupsLabel, productsLabel } from "@/lib/plural";
import type { CategorySection } from "@/lib/store/category-store";
import type { CategoryCluster, Product } from "@/lib/types";

/** Секция одной категории со списком групп. */
export const CategorySectionBlock = memo(function CategorySectionBlock({
  section,
  expanded,
  limit,
  products,
  selectedClusterIds,
  modelLinks,
  cardSize,
  onToggleSection,
  onToggleSelect,
  onOpen,
  onAddSelection,
  onRemoveSelection,
  onShowMore,
}: {
  section: CategorySection;
  expanded: boolean;
  limit: number;
  products: Map<number, Product>;
  selectedClusterIds: Set<number>;
  modelLinks: Map<number, ModelLink[]>;
  cardSize: CardWidth;
  onToggleSection: (sectionId: string) => void;
  onToggleSelect: (clusterId: number) => void;
  onOpen: (clusterId: number) => void;
  onAddSelection: (clusterIds: number[]) => void;
  onRemoveSelection: (clusterIds: number[]) => void;
  onShowMore: (sectionId: string, limit: number) => void;
}) {
  const visibleClusters = section.clusters.slice(0, limit);
  const sectionIds = section.clusters.map((cluster) => cluster.id);
  const allSelected =
    sectionIds.length > 0 &&
    sectionIds.every((id) => selectedClusterIds.has(id));

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div
        className={`flex items-center gap-2 px-3 py-2.5 ${
          section.isAttention ? "bg-destructive/5" : "bg-muted/20"
        }`}
      >
        <button
          type="button"
          onClick={() => onToggleSection(section.id)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <HugeiconsIcon
            icon={expanded ? ArrowDown01Icon : ArrowRight01Icon}
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span className="min-w-0 flex-1">
            <span
              className={`block truncate text-sm font-semibold ${
                section.isAttention ? "text-destructive" : ""
              }`}
            >
              {section.title}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {groupsLabel(section.groupCount)} ·{" "}
              {productsLabel(section.productCount)}
              {!section.isAttention && section.id ? ` · ${section.id}` : ""}
            </span>
          </span>
          {section.mixedCount > 0 ? (
            <Badge variant="destructive">
              {section.mixedCount} змішаних
            </Badge>
          ) : null}
          {section.changedCount > 0 ? (
            <Badge variant="secondary">
              {section.changedCount} перенесено
            </Badge>
          ) : null}
        </button>
        {expanded ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (allSelected) onRemoveSelection(sectionIds);
              else onAddSelection(sectionIds);
            }}
            disabled={sectionIds.length === 0}
          >
            {allSelected ? "Зняти вибір" : "Вибрати всі"}
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <div className="border-t p-3">
          {visibleClusters.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              У цій категорії поки немає груп.
            </p>
          ) : (
            <>
              <div className="grid gap-2" style={cardGridStyle(cardSize)}>
                {visibleClusters.map((cluster: CategoryCluster) => (
                  <CategoryGroupCard
                    key={cluster.id}
                    cluster={cluster}
                    products={products}
                    selected={selectedClusterIds.has(cluster.id)}
                    linkedCount={modelLinks.get(cluster.id)?.length ?? 0}
                    onToggleSelect={onToggleSelect}
                    onOpen={onOpen}
                  />
                ))}
              </div>
              {section.clusters.length > limit ? (
                <div className="mt-3 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onShowMore(section.id, limit + 50)}
                  >
                    Показати ще{" "}
                    {Math.min(50, section.clusters.length - limit)}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </Card>
  );
});
