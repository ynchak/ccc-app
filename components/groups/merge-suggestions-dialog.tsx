"use client";

import { useState } from "react";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  GroupLayersIcon,
  ImageNotFound01Icon,
  ZoomInAreaIcon,
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
  hasCommonEvidence,
  type ComparisonSide,
  type GroupComparison,
} from "@/lib/jev/comparison";
import { productsLabel } from "@/lib/plural";
import { useAppStore } from "@/lib/store/app-store";
import { notify } from "@/lib/store/toast-store";

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}



function ComparisonGallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const safeIndex = images.length > 0 ? index % images.length : 0;
  const current = images[safeIndex];
  const imageFailed = current ? failed.has(current) : false;

  const showPrev = () => {
    if (images.length < 2) return;
    setIndex((value) => (value - 1 + images.length) % images.length);
  };

  const showNext = () => {
    if (images.length < 2) return;
    setIndex((value) => (value + 1) % images.length);
  };

  return (
    <div className="relative mt-2 aspect-[4/3] overflow-hidden rounded-md bg-muted">
      {current && !imageFailed ? (
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="absolute inset-0 flex cursor-zoom-in items-center justify-center"
          aria-label="Збільшити фото"
          title="Натисніть, щоб збільшити"
        >
          <Image
            src={current}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, 480px"
            className="object-cover"
            unoptimized
            onError={() =>
              setFailed((values) => {
                const next = new Set(values);
                next.add(current);
                return next;
              })
            }
          />
        </button>
      ) : (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <HugeiconsIcon icon={ImageNotFound01Icon} className="size-5" />
        </div>
      )}

      {current && !imageFailed ? (
        <>
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="absolute top-2 right-2 z-10 flex size-7 items-center justify-center rounded-full border border-border/60 bg-background/95 text-muted-foreground"
            aria-label="Збільшити фото"
            title="Збільшити фото"
          >
            <HugeiconsIcon icon={ZoomInAreaIcon} className="size-3.5" />
          </button>
          {images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={showPrev}
                className="absolute top-1/2 left-2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background/95 text-foreground"
                aria-label="Попереднє фото"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={showNext}
                className="absolute top-1/2 right-2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background/95 text-foreground"
                aria-label="Наступне фото"
              >
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
              </button>
              <span className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border/60 bg-background/95 px-2 py-0.5 text-[11px] text-muted-foreground">
                {safeIndex + 1} / {images.length}
              </span>
            </>
          ) : null}
        </>
      ) : null}

      {lightboxOpen && images.length > 0 ? (
        <ProductImageLightbox
          images={images}
          title={title}
          initialIndex={safeIndex}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </div>
  );
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

function Side({ side }: { side: ComparisonSide }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/30 p-3">
      <div className="flex min-w-0 items-start gap-2">
        <span className="shrink-0 rounded bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
          № {side.number}
        </span>
        <p className="min-w-0 flex-1 text-sm leading-snug break-words">
          {side.title}
        </p>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {productsLabel(side.count)}
      </p>

      <ComparisonGallery images={side.images} title={side.title} />

      <dl className="mt-3 flex flex-col gap-2">
        <Values label="Бренд" values={side.brands} />
        <Values label="Продавець" values={side.sellers} />
        <Values label="Артикули" values={side.articles} />
        <Values label="База артикула" values={side.articleBases} />
        <Values label="МДГ" values={side.mdgs} />
        <Values label="Розміри" values={side.sizes} />
        <Values label="Кольори" values={side.colors} />
      </dl>

      {side.sampleTitles.length > 0 ? (
        <div className="mt-3 flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
            Приклади назв
          </span>
          <ul className="flex flex-col gap-1 text-xs leading-snug">
            {side.sampleTitles.map((title) => (
              <li key={title} className="break-words text-muted-foreground">
                {title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Evidence({ comparison }: { comparison: GroupComparison }) {
  const { common, differences } = comparison;
  const commonChips = [
    ...common.brands.map((value) => `Бренд: ${value}`),
    ...common.articleBases.map((value) => `Артикул: ${value}`),
    ...common.mdgs.map((value) => `МДГ: ${value}`),
  ];
  const differenceChips = [
    differences.titles ? "Різні назви" : null,
    differences.articles ? "Різні повні артикули" : null,
    differences.colors ? "Різні кольори" : null,
    differences.sizes ? "Різні розміри" : null,
  ].filter((value): value is string => value !== null);

  return (
    <div className="mt-3 rounded-lg border p-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Спільне</span>
        {hasCommonEvidence(comparison) && commonChips.length > 0 ? (
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const visible = suggestions.filter(
    (suggestion) =>
      groups.has(suggestion.aId) && groups.has(suggestion.bId),
  );

  const toggleExpanded = (key: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleMerge = async (aId: number, bId: number) => {
    const ok = await applyMergeSuggestion(aId, bId);
    if (ok) notify("Групи об’єднано", "success");
    else notify("Не вдалося об’єднати групи", "error");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Можливі об’єднання за моделлю</DialogTitle>
          <DialogDescription className="break-words">
            Jev знайшов пари з імовірністю 80–95%. Розгорніть картку, щоб
            порівняти фото, артикули й товари перед об’єднанням.
          </DialogDescription>
        </DialogHeader>

        {visible.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Пропозицій немає.
          </p>
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            {visible.map((suggestion) => {
              const a = groups.get(suggestion.aId);
              const b = groups.get(suggestion.bId);
              if (!a || !b) return null;

              const key = `${suggestion.aId}:${suggestion.bId}`;
              const isExpanded = expanded.has(key);
              const target = a.number <= b.number ? a : b;
              const comparison = buildGroupComparison(a, b, products);

              return (
                <div
                  key={key}
                  className="min-w-0 overflow-hidden rounded-lg border"
                >
                  <div className="p-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        Одна модель:{" "}
                        <strong className="text-foreground">
                          {percent(suggestion.sameModel)}
                        </strong>
                      </span>
                      <span>
                        Один тип:{" "}
                        <strong className="text-foreground">
                          {percent(suggestion.sameType)}
                        </strong>
                      </span>
                      <span className="truncate">
                        {a.categoryTitle || "Без категорії"}
                      </span>
                    </div>

                    <div className="mt-2 flex min-w-0 flex-col gap-1">
                      <div className="flex min-w-0 items-start gap-2 text-sm">
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          № {a.number}
                        </span>
                        <span className="min-w-0 break-words">{a.title}</span>
                      </div>
                      <div className="flex min-w-0 items-start gap-2 text-sm">
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          № {b.number}
                        </span>
                        <span className="min-w-0 break-words">{b.title}</span>
                      </div>
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">
                      Після об’єднання залишиться назва групи № {target.number}.
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(key)}
                        aria-expanded={isExpanded}
                      >
                        <HugeiconsIcon
                          icon={ArrowDown01Icon}
                          data-icon="inline-start"
                          className={isExpanded ? "rotate-180" : ""}
                        />
                        {isExpanded ? "Згорнути" : "Порівняти"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          dismissMergeSuggestion(
                            suggestion.aId,
                            suggestion.bId,
                          )
                        }
                      >
                        Пропустити
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          void handleMerge(
                            suggestion.aId,
                            suggestion.bId,
                          )
                        }
                      >
                        <HugeiconsIcon
                          icon={GroupLayersIcon}
                          data-icon="inline-start"
                        />
                        Об’єднати
                      </Button>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="border-t bg-background/40 p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Side side={comparison.a} />
                        <Side side={comparison.b} />
                      </div>
                      <Evidence comparison={comparison} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          {visible.length > 0 ? (
            <Button variant="ghost" onClick={clearMergeSuggestions}>
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
