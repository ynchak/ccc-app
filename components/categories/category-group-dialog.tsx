"use client";

import { useCallback, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  Link01Icon,
  MoreHorizontalIcon,
  Scissor01Icon,
} from "@hugeicons/core-free-icons";

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
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cardGridStyle, type CardWidth } from "@/lib/card-size";
import { CategoryPicker } from "@/components/categories/category-picker";
import { splitProductsByColor, type ColorBlock } from "@/lib/category/color-blocks";
import type { ModelLink } from "@/lib/category/links";
import { productsLabel } from "@/lib/plural";
import {
  clusterCategories,
  targetCategoryFor,
  useCategoryStore,
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

/** Заголовок и содержимое одного цветового подблока внутри группы. */
function ColorBlockSection({
  block,
  collapsed,
  selectedProductIds,
  onToggleCollapse,
  onToggleProduct,
  onToggleBlock,
}: {
  block: ColorBlock;
  collapsed: boolean;
  selectedProductIds: Set<number>;
  onToggleCollapse: () => void;
  onToggleProduct: (productId: number) => void;
  onToggleBlock: (productIds: number[]) => void;
}) {
  const blockIds = block.products.map((product) => product.id);
  const allSelected =
    blockIds.length > 0 && blockIds.every((id) => selectedProductIds.has(id));

  return (
    <section
      className={`overflow-hidden rounded-lg border ${
        block.isMissing ? "border-dashed" : ""
      }`}
    >
      <div
        className={`flex items-center gap-2 px-3 py-2 ${
          block.isMissing ? "bg-muted/15" : "bg-muted/30"
        }`}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={!collapsed}
        >
          <HugeiconsIcon
            icon={collapsed ? ArrowRight01Icon : ArrowDown01Icon}
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {block.label}
          </span>
          <Badge variant="outline" className="shrink-0">
            {productsLabel(block.products.length)}
          </Badge>
        </button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onToggleBlock(blockIds)}
        >
          {allSelected ? "Зняти вибір" : "Вибрати всі"}
        </Button>
      </div>

      {collapsed ? null : (
        <div className="grid grid-cols-1 gap-3 border-t p-3 sm:grid-cols-2 lg:grid-cols-3">
          {block.products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              mode="embedded"
              selected={selectedProductIds.has(product.id)}
              onSelectionChange={() => onToggleProduct(product.id)}
            />
          ))}
        </div>
      )}
    </section>
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
  const [collapsedColorKeys, setCollapsedColorKeys] = useState<Set<string>>(
    new Set(),
  );
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingRename, setEditingRename] = useState(false);
  const [editingColor, setEditingColor] = useState(false);
  const [draftTitleRu, setDraftTitleRu] = useState(cluster?.title ?? "");
  const [draftTitleUk, setDraftTitleUk] = useState(cluster?.titleUk ?? "");
  const [draftColorByBlock, setDraftColorByBlock] = useState<Map<string, string>>(new Map());
  const [isRenaming, setIsRenaming] = useState(false);
  const renameCluster = useCategoryStore((state) => state.renameClusterProducts);
  const updateClusterColorAction = useCategoryStore.getState().updateClusterColor;
  const colorBlocks = useMemo(() => splitProductsByColor(members), [members]);
  const showColorBlocks = colorBlocks.length > 1;

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

  /** Выбирает все товары блока целиком или снимает выбор со всех. */
  const toggleBlock = (productIds: number[]) => {
    setSelectedProductIds((current) => {
      const allSelected = productIds.every((id) => current.has(id));
      const next = new Set(current);
      for (const id of productIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const toggleColorCollapse = (key: string) => {
    setCollapsedColorKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleStartEditTitle = () => {
    setDraftTitleRu(cluster.title);
    setDraftTitleUk(cluster.titleUk ?? "");
    setEditingTitle(true);
  };

  const handleCancelEditTitle = () => {
    setEditingTitle(false);
    setDraftTitleRu(cluster.title);
    setDraftTitleUk(cluster.titleUk ?? "");
  };

  const handleStartEditColor = () => {
    const next = new Map<string, string>();
    for (const block of colorBlocks) {
      const firstColor = block.products[0]?.color ?? "";
      next.set(block.key || "no-color", firstColor);
    }
    setDraftColorByBlock(next);
    setEditingColor(true);
  };

  const handleCancelEditColor = () => {
    setEditingColor(false);
    setDraftColorByBlock(new Map());
  };

  const handleChangeBlockColor = (blockKey: string, value: string) => {
    setDraftColorByBlock((current) => {
      const next = new Map(current);
      next.set(blockKey, value.trim());
      return next;
    });
  };

  const handleSaveColor = useCallback(async () => {
    if (!cluster) return;

    const updates: Array<{ blockKey: string; color: string | null }> = [];
    for (const [blockKey, color] of draftColorByBlock) {
      updates.push({ blockKey, color: color || null });
    }

    const uniqueColors = new Set(updates.map((u) => u.color));
    if (uniqueColors.size === 1 && uniqueColors.has(null)) {
      setEditingColor(false);
      setDraftColorByBlock(new Map());
      return;
    }

    setIsRenaming(true);
    try {
      for (const { blockKey, color } of updates) {
        const block = colorBlocks.find(
          (b) => (b.key || "no-color") === blockKey,
        );
        if (!block) continue;
        const ok = await updateClusterColorAction(cluster.id, color);
        if (!ok) {
          console.error("Не удалось изменить цвет для блока " + blockKey);
        }
      }
      setEditingColor(false);
      setDraftColorByBlock(new Map());
    } finally {
      setIsRenaming(false);
    }
  }, [cluster, draftColorByBlock, colorBlocks, updateClusterColorAction]);

  const handleSaveTitle = useCallback(async () => {
    if (!cluster) return;
    const nextRu = draftTitleRu.trim();
    const nextUk = draftTitleUk.trim() || undefined;
    if (!nextRu) return;

    setIsRenaming(true);
    try {
      const ok = await renameCluster(cluster.id, nextRu, nextUk);
      if (ok) {
        setEditingTitle(false);
      }
    } finally {
      setIsRenaming(false);
    }
  }, [cluster, draftTitleRu, draftTitleUk, renameCluster]);

  const handleSaveSelectedTitles = useCallback(async () => {
    if (!cluster) return;
    const nextRu = draftTitleRu.trim();
    const nextUk = draftTitleUk.trim() || undefined;
    if (!nextRu) return;

    const productUpdates = new Map(
      [...selectedProductIds].map((productId) => [
        productId,
        { goodsTitle: nextRu, goodsTitleUk: nextUk },
      ]),
    );

    setIsRenaming(true);
    try {
      const ok = await renameCluster(
        cluster.id,
        nextRu,
        nextUk,
        productUpdates,
      );
      if (ok) {
        setEditingRename(false);
        setSelectedProductIds(new Set());
      }
    } finally {
      setIsRenaming(false);
    }
  }, [cluster, draftTitleRu, draftTitleUk, selectedProductIds, renameCluster]);

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

        <div className="mt-4 flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
          <div className="flex items-start gap-2">
            {!editingTitle && !editingRename && !editingColor && (
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button variant="outline" size="sm">
                    <HugeiconsIcon icon={MoreHorizontalIcon} data-icon="inline-start" />
                    Дії
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={handleStartEditTitle}
                      disabled={isRenaming}
                    >
                      Змінити назву групи
                    </DropdownMenuItem>
                    {selectedProductIds.size > 0 && (
                      <DropdownMenuItem
                        onClick={() => {
                          setDraftTitleRu(cluster.title);
                          setDraftTitleUk(cluster.titleUk ?? "");
                          setEditingRename(true);
                        }}
                        disabled={isRenaming}
                      >
                        Змінити назви
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={handleStartEditColor}
                      disabled={isRenaming || colorBlocks.length === 0}
                    >
                      Змінити кольори
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <div className="min-w-0 flex-1">
              {editingTitle || editingRename ? null : (
                <div className="text-sm font-medium truncate">
                  {cluster.title}
                </div>
              )}
              {editingTitle && (
                <div className="flex flex-col gap-1">
                  <Input
                    value={draftTitleRu}
                    onChange={(event) => setDraftTitleRu(event.target.value)}
                    placeholder={cluster.title}
                    aria-label="Назва групи (RU)"
                    className="w-full text-sm"
                  />
                  <Input
                    value={draftTitleUk}
                    onChange={(event) => setDraftTitleUk(event.target.value)}
                    placeholder={cluster.titleUk || ""}
                    aria-label="Назва групи (UA)"
                    className="w-full text-sm"
                  />
                  <div className="flex gap-2 mt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEditTitle}
                      disabled={isRenaming}
                    >
                      Скасувати
                    </Button>
                    <Button
                      onClick={handleSaveTitle}
                      disabled={isRenaming || !draftTitleRu.trim()}
                    >
                      {isRenaming ? "Зберігаю…" : "Зберегти"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Зміна назви групи застосується до всіх товарів кластера.
                  </p>
                </div>
              )}
              {editingRename && (
                <div className="flex flex-col gap-1">
                  <Input
                    value={draftTitleRu}
                    onChange={(event) => setDraftTitleRu(event.target.value)}
                    placeholder={cluster.title}
                    aria-label="Нова назва (RU)"
                    className="w-full text-sm"
                  />
                  <Input
                    value={draftTitleUk}
                    onChange={(event) => setDraftTitleUk(event.target.value)}
                    placeholder={cluster.titleUk || ""}
                    aria-label="Нова назва (UA)"
                    className="w-full text-sm"
                  />
                  <div className="flex gap-2 mt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingRename(false);
                        setDraftTitleRu(cluster.title);
                        setDraftTitleUk(cluster.titleUk ?? "");
                      }}
                      disabled={isRenaming}
                    >
                      Скасувати
                    </Button>
                    <Button
                      onClick={handleSaveSelectedTitles}
                      disabled={isRenaming || !draftTitleRu.trim()}
                    >
                      {isRenaming ? "Зберігаю…" : "Зберегти"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Зміни застосуються лише до вибраних товарів ({selectedProductIds.size}).
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {editingColor ? (
          <div className="mt-4 flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span>Змінити кольори товарів</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {colorBlocks.map((block) => (
                <div
                  key={block.key || 'no-color'}
                  className="flex flex-col gap-2 p-3 rounded border border-muted"
                >
                  <div className="flex items-center gap-1 px-2 py-1 bg-muted/50 rounded">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {block.isMissing ? 'Без кольору' : block.label}
                    </span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {block.products.length} товар{block.products.length === 1 ? '' : 'ів'}
                    </span>
                  </div>
                  <Input
                    value={draftColorByBlock.get(block.key || 'no-color') ?? ''}
                    onChange={(event) =>
                      handleChangeBlockColor(
                        block.key || 'no-color',
                        event.target.value,
                      )
                    }
                    placeholder={block.label || ''}
                    aria-label={'Колір для ' + (block.label || 'товари')}
                    className="w-full text-xs"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEditColor}
                disabled={isRenaming}
              >
                Скасувати
              </Button>
              <Button
                onClick={handleSaveColor}
                disabled={isRenaming}
              >
                {isRenaming ? 'Зберігаю…' : 'Зберегти'}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Зміна кольору застосується до всіх товарів кластера.
            </p>
          </div>
        ) : null}

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

        {showColorBlocks ? (
          <div className="flex flex-col gap-3">
            {colorBlocks.map((block) => (
              <ColorBlockSection
                key={block.key || "no-color"}
                block={block}
                collapsed={collapsedColorKeys.has(block.key)}
                selectedProductIds={selectedProductIds}
                onToggleCollapse={() => toggleColorCollapse(block.key)}
                onToggleProduct={toggleProduct}
                onToggleBlock={toggleBlock}
              />
            ))}
          </div>
        ) : (
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
        )}
      </DialogContent>
    </Dialog>
  );
}
