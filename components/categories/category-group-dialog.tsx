"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link01Icon, Scissor01Icon } from "@hugeicons/core-free-icons";

import { ProductCard } from "@/components/groups/product-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cardGridStyle, type CardWidth } from "@/lib/card-size";
import { CategoryPicker } from "@/components/categories/category-picker";
import type { ModelLink } from "@/lib/category/links";
import { productsLabel } from "@/lib/plural";
import {
  clusterCategories,
  targetCategoryFor,
} from "@/lib/store/category-store";
import type { CategoryCluster, CategoryRef, Product } from "@/lib/types";

/** Превью другой группы, с которой предлагается объединение. */
function ModelLinkCard({
  link,
  products,
  currentCount,
  cardSize,
  onMerge,
}: {
  link: ModelLink;
  products: Map<number, Product>;
  currentCount: number;
  cardSize: CardWidth;
  onMerge: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const targetProducts = link.productIds
    .map((productId) => products.get(productId))
    .filter((product): product is Product => product !== undefined)
    .sort((a, b) => a.order - b.order);
  const previewProducts = showAll
    ? targetProducts
    : targetProducts.slice(0, 2);
  const kindLabel =
    link.kind === "article"
      ? "спільний артикул"
      : link.kind === "mdg"
        ? "спільна модель"
        : "код у назві";

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-2.5">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium">
            #{link.number} · {link.title}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {link.categoryTitle} · {productsLabel(link.productCount)} ·{" "}
            {kindLabel}: {link.key}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Після об’єднання: {productsLabel(currentCount + link.productCount)}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onMerge}>
          Об’єднати
        </Button>
      </div>

      <div
        className={`grid gap-2 ${showAll ? "max-h-[36rem] overflow-y-auto pr-1" : ""}`}
        style={cardGridStyle(cardSize)}
      >
        {previewProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            mode="preview"
          />
        ))}
      </div>

      {targetProducts.length > 2 ? (
        <Button
          variant="ghost"
          size="xs"
          className="self-start"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll
            ? "Згорнути товари"
            : `Показати всі ${productsLabel(targetProducts.length)}`}
        </Button>
      ) : null}
    </div>
  );
}

/** Модальное окно группы с товарами и действиями. */
export function CategoryGroupDialog({
  cluster,
  products,
  categories,
  links,
  cardSize,
  open,
  onOpenChange,
  onSetTarget,
  onSplit,
  onDetach,
  onMerge,
}: {
  cluster: CategoryCluster | null;
  products: Map<number, Product>;
  categories: CategoryRef[];
  links: ModelLink[];
  cardSize: CardWidth;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetTarget: (categoryId: string, categoryTitle: string) => void;
  onSplit: () => void;
  onDetach: (productIds: number[]) => void;
  onMerge: (otherClusterId: number) => void;
}) {
  const members = useMemo(
    () =>
      cluster
        ? cluster.productIds
            .map((id) => products.get(id))
            .filter((product): product is Product => product !== undefined)
            .sort((a, b) => a.order - b.order)
        : [],
    [cluster, products],
  );
  const categoryCounts = useMemo(
    () => (cluster ? clusterCategories(cluster, products) : []),
    [cluster, products],
  );
  const fallbackTarget =
    cluster?.targetCategoryId ??
    (categoryCounts.length === 1 ? categoryCounts[0].id : "");
  const [draftCategoryId, setDraftCategoryId] = useState(fallbackTarget);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(
    new Set(),
  );

  if (!cluster) return null;

  const first = members[0];
  const mixed = categoryCounts.length > 1;
  const selectedCount = selectedProductIds.size;
  const canDetach = selectedCount > 0 && selectedCount < members.length;
  const target = first ? targetCategoryFor(cluster, first) : null;
  const currentCategoryId =
    categoryCounts.length === 1 ? categoryCounts[0].id : "";
  const canMove =
    Boolean(draftCategoryId) &&
    (cluster.targetCategoryId
      ? draftCategoryId !== cluster.targetCategoryId
      : mixed || draftCategoryId !== currentCategoryId);

  const toggleProduct = (productId: number) => {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const handleSave = () => {
    if (!draftCategoryId) return;
    const category = categories.find((item) => item.id === draftCategoryId);
    onSetTarget(draftCategoryId, category?.title ?? draftCategoryId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="pr-8">{cluster.title}</DialogTitle>
          <DialogDescription>
            Група #{cluster.number} · {productsLabel(members.length)}
            {first?.goodsArticle ? ` · арт. ${first.goodsArticle}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-1.5">
          {categoryCounts.map((category) => (
            <Badge
              key={category.id || "no-category"}
              variant={mixed ? "destructive" : "outline"}
              title={category.id}
            >
              {category.title}
              {mixed ? ` · ${category.count}` : ""}
            </Badge>
          ))}
          {target &&
          cluster.targetCategoryId &&
          members.some(
            (product) =>
              (product.originalCategoryId ?? product.categoryId) !==
              cluster.targetCategoryId,
          ) ? (
            <Badge variant="secondary">Буде перенесено</Badge>
          ) : null}
          {mixed ? (
            <Badge variant="destructive">У групі {categoryCounts.length} категорії</Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/20 p-3">
          <div className="flex min-w-56 flex-1 flex-col gap-1 text-xs text-muted-foreground">
            <span>Категорія для всієї групи</span>
            <CategoryPicker
              categories={categories}
              value={draftCategoryId}
              onChange={setDraftCategoryId}
              placeholder="Оберіть категорію"
              ariaLabel="Категорія для всієї групи"
            />
          </div>
          <Button onClick={handleSave} disabled={!canMove}>
            Перенести групу
          </Button>
          {mixed ? (
            <Button variant="outline" onClick={onSplit}>
              Розділити за категоріями
            </Button>
          ) : null}
          {canDetach ? (
            <Button
              variant="outline"
              onClick={() => onDetach([...selectedProductIds])}
            >
              <HugeiconsIcon icon={Scissor01Icon} data-icon="inline-start" />
              Відокремити вибрані ({selectedCount})
            </Button>
          ) : null}
        </div>

        {links.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <HugeiconsIcon icon={Link01Icon} className="size-3.5" />
              Можливо, одна модель — перевірте, що саме об’єднаєте
            </span>
            {links.map((link) => (
              <ModelLinkCard
                key={`${link.clusterId}-${link.kind}-${link.key}`}
                link={link}
                products={products}
                currentCount={members.length}
                cardSize={cardSize}
                onMerge={() => onMerge(link.clusterId)}
              />
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              mode="embedded"
              selected={selectedProductIds.has(product.id)}
              onSelectionChange={() => toggleProduct(product.id)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
