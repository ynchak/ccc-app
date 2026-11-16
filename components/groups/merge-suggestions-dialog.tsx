"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  GroupLayersIcon,
  ImageNotFound01Icon,
} from "@hugeicons/core-free-icons";

import { ProductImageLightbox } from "@/components/groups/product-image-lightbox";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildGroupComparison,
  uniqueColorProducts,
  type ComparisonProduct,
  type ComparisonSide,
  type GroupComparison,
} from "@/lib/jev/comparison";
import {
  formatPriceSummary,
  formatPriceUah,
  summarizePrices,
} from "@/lib/price";
import { productsLabel } from "@/lib/plural";
import { cardImageUrl } from "@/lib/product-images";
import { useAppStore } from "@/lib/store/app-store";
import { notify } from "@/lib/store/toast-store";

/** Сколько товаров показывать в группе до кнопки «Показати всі». */
const PREVIEW_LIMIT = 5;

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function Values({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] text-muted-foreground uppercase tracking-wide">
        {label}
      </dt>
      <dd className="break-words text-sm">{values.join(", ")}</dd>
    </div>
  );
}

/** Мини-карточка товара: полное фото, название, размер/цвет и цена. */
function ProductPreview({
  product,
  showPrice,
  featured = false,
}: {
  product: ComparisonProduct;
  showPrice: boolean;
  featured?: boolean;
}) {
  const [variantFailed, setVariantFailed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const firstImage = product.images[0];
  const displaySrc = firstImage
    ? variantFailed
      ? firstImage
      : cardImageUrl(firstImage)
    : "";
  const price = product.price ? formatPriceUah(product.price) : "";

  return (
    <div
      className={`flex min-w-0 flex-col gap-1.5 rounded-md border bg-background p-1.5 ${
        featured ? "col-span-2" : ""
      }`}
    >
      <div
        className={`relative overflow-hidden rounded bg-muted ${
          featured ? "aspect-[4/3]" : "aspect-square"
        }`}
      >
        {firstImage && !failed ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="absolute inset-0 flex cursor-zoom-in items-center justify-center"
            aria-label={`Збільшити фото ${product.title}`}
            title="Натисніть, щоб збільшити"
          >
            <Image
              src={displaySrc}
              alt={product.title}
              fill
              sizes={
                featured
                  ? "(max-width: 640px) 90vw, 480px"
                  : "(max-width: 640px) 45vw, 220px"
              }
              className="object-contain"
              unoptimized
              onError={() => {
                if (displaySrc !== firstImage && !variantFailed) {
                  setVariantFailed(true);
                  return;
                }
                setFailed(true);
              }}
            />
          </button>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <HugeiconsIcon icon={ImageNotFound01Icon} className="size-5" />
          </div>
        )}

        {product.images.length > 1 ? (
          <span className="pointer-events-none absolute right-1.5 bottom-1.5 rounded-full border border-border/60 bg-background/95 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {product.images.length} фото
          </span>
        ) : null}
      </div>

      <p
        className={`line-clamp-2 leading-snug font-medium break-words ${
          featured ? "text-sm" : "text-[11px]"
        }`}
        title={product.title}
      >
        {product.title}
      </p>

      {product.size || product.color ? (
        <div
          className={`flex flex-wrap gap-1 text-muted-foreground ${
            featured ? "text-[11px]" : "text-[10px]"
          }`}
        >
          {product.size ? (
            <span className="rounded bg-muted px-1 py-0.5">
              {product.size}
            </span>
          ) : null}
          {product.color ? (
            <span className="rounded bg-muted px-1 py-0.5">
              {product.color}
            </span>
          ) : null}
        </div>
      ) : null}

      {showPrice ? (
        <span
          className={`font-semibold tabular-nums text-foreground ${
            featured ? "text-sm" : "text-xs"
          }`}
        >
          {price || <span className="text-muted-foreground">—</span>}
        </span>
      ) : null}

      {lightboxOpen && product.images.length > 0 ? (
        <ProductImageLightbox
          images={product.images}
          title={product.title}
          initialIndex={0}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </div>
  );
}

/** Одна группа в сравнении: товары, цена и вторичные характеристики. */
function GroupSide({ side }: { side: ComparisonSide }) {
  const [expanded, setExpanded] = useState(false);

  const summary = summarizePrices(
    side.products.map((product) => product.price),
  );
  const priceText = formatPriceSummary(summary);
  const showProductPrices =
    summary.values.length > 0 &&
    (summary.values.length > 1 || summary.missing > 0);
  const colorProducts = uniqueColorProducts(side.products);
  const visibleProducts = expanded
    ? colorProducts
    : colorProducts.slice(0, PREVIEW_LIMIT);

  return (
    <div className="min-w-0 rounded-lg border bg-muted/20 p-3">
      <div className="flex min-w-0 items-start gap-2">
        <span className="shrink-0 rounded bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
          № {side.number}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug font-medium break-words">
            {side.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{productsLabel(side.count)}</span>
            <span className="font-medium text-foreground">{priceText}</span>
            {summary.missing > 0 && summary.values.length > 0 ? (
              <span className="text-amber-600 dark:text-amber-400">
                без ціни: {summary.missing}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {side.products.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Немає товарів для показу.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {visibleProducts.map((product, index) => (
              <ProductPreview
                key={product.id}
                product={product}
                showPrice={showProductPrices}
                featured={index === 0}
              />
            ))}
          </div>

          {colorProducts.length > PREVIEW_LIMIT ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
            >
              {expanded
                ? "Згорнути"
                : `Показати всі (${colorProducts.length})`}
            </Button>
          ) : null}
        </>
      )}

      <details className="mt-3 rounded-md border bg-background/60 px-2.5 py-2">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
          Деталі
        </summary>
        <dl className="mt-2 flex flex-col gap-1.5">
          <Values label="Бренд" values={side.brands} />
          <Values label="Продавець" values={side.sellers} />
          <Values label="Артикули" values={side.articles} />
          <Values label="База артикула" values={side.articleBases} />
          <Values label="МДГ" values={side.mdgs} />
          <Values label="Розміри" values={side.sizes} />
          <Values label="Кольори" values={side.colors} />
        </dl>
      </details>
    </div>
  );
}

function Evidence({ comparison }: { comparison: GroupComparison }) {
  const { common, differences } = comparison;
  const commonChips = [
    ...common.brands.map((value) => `Бренд: ${value}`),
    ...common.articleBases.map((value) => `Артикул: ${value}`),
    ...common.mdgs.map((value) => `МДГ: ${value}`),
    ...common.prices.map((value) => `Ціна: ${formatPriceUah(value)}`),
  ];
  const differenceChips = [
    differences.titles ? "Різні назви" : null,
    differences.articles ? "Різні повні артикули" : null,
    differences.prices ? "Різні ціни" : null,
    differences.colors ? "Різні кольори" : null,
    differences.sizes ? "Різні розміри" : null,
  ].filter((value): value is string => value !== null);

  return (
    <div className="mt-3 rounded-lg border p-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Спільне</span>
        {commonChips.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {commonChips.map((value) => (
              <Badge
                key={value}
                variant="secondary"
                className="text-[11px] font-normal"
              >
                {value}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            Спільних ознак не знайдено.
          </span>
        )}
      </div>

      {differenceChips.length > 0 ? (
        <div className="mt-3 flex flex-col gap-1.5">
          <span className="text-xs font-medium">Відмінне</span>
          <div className="flex flex-wrap gap-1">
            {differenceChips.map((value) => (
              <Badge
                key={value}
                variant="outline"
                className="text-[11px] font-normal text-muted-foreground"
              >
                {value}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Диалог с парами групп, которые Jev считает вероятными объединениями,
 * но уверенность ниже порога автоматического слияния.
 *
 * Пары показываются по одной: после «Пропустити» или «Об’єднати» сразу
 * появляется следующая.
 */
export function MergeSuggestionsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const groups = useAppStore((s) => s.groups);
  const products = useAppStore((s) => s.products);
  const suggestions = useAppStore((s) => s.mergeSuggestions);
  const applyMergeSuggestion = useAppStore((s) => s.applyMergeSuggestion);
  const dismissMergeSuggestion = useAppStore((s) => s.dismissMergeSuggestion);
  const clearMergeSuggestions = useAppStore((s) => s.clearMergeSuggestions);

  const visible = suggestions.filter(
    (suggestion) =>
      groups.has(suggestion.aId) && groups.has(suggestion.bId),
  );

  const [sessionStartCount, setSessionStartCount] = useState(0);
  const [prevOpen, setPrevOpen] = useState(false);
  if (prevOpen !== open) {
    setPrevOpen(open);
    setSessionStartCount(open ? visible.length : 0);
  }

  const total = sessionStartCount || visible.length;
  const reviewed = Math.max(0, total - visible.length);
  const currentNumber =
    visible.length > 0 ? Math.min(reviewed + 1, total) : total;
  const progress =
    total > 0 ? Math.min(100, Math.max(0, (reviewed / total) * 100)) : 0;

  const current = visible[0];
  const a = current ? groups.get(current.aId) : undefined;
  const b = current ? groups.get(current.bId) : undefined;
  const comparison = a && b ? buildGroupComparison(a, b, products) : null;
  const target = a && b ? (a.number <= b.number ? a : b) : null;
  const canShow = Boolean(current && a && b && comparison && target);

  const contentRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    contentRef.current?.scrollTo({ top: 0 });
  }, [open, current?.aId, current?.bId]);

  // Защита от двойного клика: после действия следующая пара появляется
  // на том же месте, и второй клик мог бы пропустить/объединить уже её.
  const [actionLocked, setActionLocked] = useState(false);
  const [merging, setMerging] = useState(false);
  const lockAction = () => {
    setActionLocked(true);
    window.setTimeout(() => setActionLocked(false), 300);
  };

  const handleMerge = async (aId: number, bId: number) => {
    if (actionLocked || merging) return;
    lockAction();
    setMerging(true);
    try {
      const ok = await applyMergeSuggestion(aId, bId);
      if (ok) notify("Групи об’єднано", "success");
      else notify("Не вдалося об’єднати групи", "error");
    } finally {
      setMerging(false);
    }
  };

  const handleSkip = (aId: number, bId: number) => {
    if (actionLocked || merging) return;
    lockAction();
    dismissMergeSuggestion(aId, bId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        className="max-h-[calc(100dvh-2rem)] min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-5xl"
      >
        <DialogHeader>
          <DialogTitle>Можливі об’єднання за моделлю</DialogTitle>
          <DialogDescription className="break-words">
            {visible.length > 0
              ? "Порівняйте пару груп. Після «Пропустити» або «Об’єднати» з’явиться наступна."
              : total > 0
                ? "Усі пропозиції переглянуто."
                : "Пропозицій немає."}
          </DialogDescription>
        </DialogHeader>

        {visible.length > 0 ? (
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Пропозиція {currentNumber} з {total}
              </span>
              <span>Залишилось: {visible.length}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground/40 transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        {canShow && current && a && b && comparison && target ? (
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                Одна модель:{" "}
                <strong className="text-foreground">
                  {percent(current.sameModel)}
                </strong>
              </span>
              <span>
                Один тип:{" "}
                <strong className="text-foreground">
                  {percent(current.sameType)}
                </strong>
              </span>
              <span className="truncate">
                {a.categoryTitle || "Без категорії"}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              Після об’єднання залишиться назва групи № {target.number}.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <GroupSide key={comparison.a.id} side={comparison.a} />
              <GroupSide key={comparison.b.id} side={comparison.b} />
            </div>

            <Evidence comparison={comparison} />

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={actionLocked || merging}
                onClick={() => handleSkip(current.aId, current.bId)}
              >
                Пропустити
              </Button>
              <Button
                size="sm"
                disabled={actionLocked || merging}
                onClick={() => void handleMerge(current.aId, current.bId)}
              >
                <HugeiconsIcon
                  icon={GroupLayersIcon}
                  data-icon="inline-start"
                />
                Об’єднати
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {visible.length === 0 && total > 0
              ? "Усі пропозиції переглянуто."
              : "Пропозицій немає."}
          </div>
        )}

        <DialogFooter>
          {visible.length > 0 ? (
            <Button
              variant="ghost"
              className="sm:mr-auto"
              onClick={clearMergeSuggestions}
            >
              Пропустити все
            </Button>
          ) : null}
          <DialogClose render={<Button variant="outline" />}>
            Закрити
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
