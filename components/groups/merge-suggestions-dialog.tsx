"use client";

import { useState } from "react";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ExternalLinkIcon,
  GroupLayersIcon,
  ImageNotFound01Icon,
} from "@hugeicons/core-free-icons";

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

function Thumbnail({ src, title }: { src: string; title: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
      {failed ? (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <HugeiconsIcon icon={ImageNotFound01Icon} className="size-4" />
        </div>
      ) : (
        <Image
          src={src}
          alt={title}
          fill
          sizes="160px"
          className="object-cover"
          unoptimized
          onError={() => setFailed(true)}
        />
      )}
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

function Side({
  side,
  onOpen,
}: {
  side: ComparisonSide;
  onOpen: (groupId: number) => void;
}) {
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

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {productsLabel(side.count)}
        </span>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onOpen(side.id)}
          title="Відкрити групу в списку"
        >
          <HugeiconsIcon icon={ExternalLinkIcon} data-icon="inline-start" />
          Відкрити
        </Button>
      </div>

      {side.images.length > 0 ? (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {side.images.map((image) => (
            <Thumbnail key={image} src={image} title={side.title} />
          ))}
        </div>
      ) : (
        <div className="mt-2 flex h-20 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
          Немає фото
        </div>
      )}

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
  onOpenGroup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenGroup: (groupId: number) => void;
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
                        <Side side={comparison.a} onOpen={onOpenGroup} />
                        <Side side={comparison.b} onOpen={onOpenGroup} />
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
