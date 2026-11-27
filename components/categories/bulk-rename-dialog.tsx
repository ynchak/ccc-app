"use client";

import { useEffect, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { useCategoryStore } from "@/lib/store/category-store";
import { notify } from "@/lib/store/toast-store";
import type { Product } from "@/lib/types";

interface BulkRenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clusterIds: number[];
  products: Map<number, Product>;
}

export function BulkRenameDialog({
  open,
  onOpenChange,
  clusterIds,
  products,
}: BulkRenameDialogProps) {
  const renameClustersBatch = useCategoryStore(
    (state) => state.renameClustersBatch,
  );
  const clusters = useCategoryStore((state) => state.clusters);

  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [titleRu, setTitleRu] = useState(true);
  const [titleUk, setTitleUk] = useState(true);
  const [useRegex, setUseRegex] = useState(false);
  const [regexError, setRegexError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);

  // Валідація регулярного виразу
  useEffect(() => {
    if (!useRegex || !findText) {
      setRegexError(null);
      return;
    }
    try {
      new RegExp(findText);
      setRegexError(null);
    } catch (error) {
      setRegexError(
        error instanceof Error ? error.message : "Некоректне регулярне вираження",
      );
    }
  }, [useRegex, findText]);

  // Подрахунок товарів, де знайдено підрядок
  const totalAffected = useMemo(() => {
    if (!findText) return 0;
    let count = 0;
    let regex: RegExp | null = null;
    if (useRegex) {
      try {
        const re = new RegExp(findText);
        const flags = re.flags.includes("g") ? re.flags : "g" + re.flags;
        regex = new RegExp(findText, flags);
      } catch {
        return 0;
      }
    }
    for (const clusterId of clusterIds) {
      const cluster = clusters.get(clusterId);
      if (!cluster) continue;
      for (const productId of cluster.productIds) {
        const product = products.get(productId);
        if (!product) continue;
        const hasRu =
          titleRu &&
          product.goodsTitle &&
          (useRegex && regex
            ? regex.test(product.goodsTitle)
            : product.goodsTitle.includes(findText));
        const hasUk =
          titleUk &&
          product.goodsTitleUk &&
          (useRegex && regex
            ? regex.test(product.goodsTitleUk)
            : product.goodsTitleUk.includes(findText));
        if (hasRu || hasUk) count++;
      }
    }
    return count;
  }, [clusterIds, clusters, products, findText, titleRu, titleUk, useRegex]);

  const handleSave = async () => {
    if (!findText) return;
    if (useRegex && regexError) return;
    setIsRenaming(true);
    try {
      const count = await renameClustersBatch(clusterIds, findText, replaceText, {
        titleRu,
        titleUk,
        useRegex,
      });
      onOpenChange(false);
      setFindText("");
      setReplaceText("");
      if (count > 0) {
        notify(`Оновлено товарів: ${count}`, "success");
      } else {
        notify("Не знайдено жодного товару для змін", "error");
      }
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Помилка при перейменуванні",
        "error",
      );
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Масове перейменування назв</DialogTitle>
          <DialogDescription>
            Змінити підрядок у найменуванні товарів вибраних груп
            ({clusterIds.length} груп).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-1">
                  <Label htmlFor="find-text">Замінити рядок</Label>
                  <span className="cursor-help text-muted-foreground">?</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-1.5 text-xs">
                  <p className="font-medium text-foreground">Підказка:</p>
                  <p className="text-muted-foreground">
                    Без регулярних виразів:
                  </p>
                  <p className="text-muted-foreground">
                    Замінити рядок: <span className="font-mono">Нижня Білизна Жіноча</span>
                  </p>
                  <p className="text-muted-foreground">
                    На рядок: <span className="font-mono">Бюстгалтер</span>
                  </p>
                  <p className="text-muted-foreground">
                    Результат: <span className="font-mono">Бюстгалтер Біла - CL1067125 - L - Білий</span>
                  </p>
                  <p className="text-muted-foreground">
                    З регулярним виразом:
                  </p>
                  <p className="text-muted-foreground">
                    Замінити рядок: <span className="font-mono">^Нижня Білизна Жіноча \S+</span>
                  </p>
                  <p className="text-muted-foreground">
                    На рядок: <span className="font-mono">Бюстгалтер</span>
                  </p>
                  <p className="text-muted-foreground">
                    Результат: <span className="font-mono">Бюстгалтер - CL1067125 - L - Білий</span>
                  </p>
                  <p className="text-muted-foreground text-[10px]">
                    Увімкніть «Регулярне вираження» для другого прикладу.
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
            <Input
              id="find-text"
              value={findText}
              onChange={(event) => setFindText(event.target.value)}
              placeholder={
                useRegex
                  ? "Наприклад: Нижня Білизна Жіноча .+"
                  : "Наприклад: Нижня Білизна Жіноча Сіра"
              }
              aria-label="Текст для заміни"
              className="w-full"
            />
            <Collapsible>
              <CollapsibleTrigger render={() => (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-left gap-2"
                >
                  <HugeiconsIcon
                    icon={
                      open ? ArrowUp01Icon : ArrowDown01Icon
                    }
                    data-icon="inline-start"
                  />
                  Приклади використання
                </Button>
              )} />
              <CollapsibleContent className="mt-2 space-y-3 p-3 rounded-lg border bg-muted/50">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    1. Без регулярних виразів (проста заміна підстроки)
                  </p>
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex gap-2">
                      <span className="w-24 text-muted-foreground">Замінити:</span>
                      <span className="font-mono">Нижня Білизна Жіноча</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-24 text-muted-foreground">На рядок:</span>
                      <span className="font-mono">Бюстгалтер</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-24 text-muted-foreground">Результат:</span>
                      <span className="font-mono">Бюстгалтер Біла - CL1067125 - L - Білий</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1 pt-2 border-t border-muted">
                  <p className="text-xs font-medium text-foreground">
                    2. З регулярним виразом (замінити слово після фрази)
                  </p>
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex gap-2">
                      <span className="w-24 text-muted-foreground">Замінити:</span>
                      <span className="font-mono">^Нижня Білизна Жіноча \S+</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-24 text-muted-foreground">На рядок:</span>
                      <span className="font-mono">Бюстгалтер</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-24 text-muted-foreground">Результат:</span>
                      <span className="font-mono">Бюстгалтер - CL1067125 - L - Білий</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Увімкніть чекбокс «Регулярне вираження»
                    </p>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
            {regexError && (
              <p className="text-[11px] text-destructive">
                {regexError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="replace-text">На рядок</Label>
            <Input
              id="replace-text"
              value={replaceText}
              onChange={(event) => setReplaceText(event.target.value)}
              placeholder="Наприклад: Бюстгалетр"
              aria-label="Новий текст"
              className="w-full"
            />
          </div>

          <div className="flex items-start gap-4">
            <div className="flex items-start gap-2">
              <input
                id="title-ru"
                type="checkbox"
                checked={titleRu}
                onChange={(event) => setTitleRu(event.target.checked)}
                disabled={isRenaming}
              />
              <Label
                htmlFor="title-ru"
                className="text-sm font-medium cursor-pointer disabled:opacity-50"
              >
                Назва (RU)
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <input
                id="title-uk"
                type="checkbox"
                checked={titleUk}
                onChange={(event) => setTitleUk(event.target.checked)}
                disabled={isRenaming}
              />
              <Label
                htmlFor="title-uk"
                className="text-sm font-medium cursor-pointer disabled:opacity-50"
              >
                Назва (UA)
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <input
                id="use-regex"
                type="checkbox"
                checked={useRegex}
                onChange={(event) => setUseRegex(event.target.checked)}
                disabled={isRenaming}
              />
              <Label
                htmlFor="use-regex"
                className="text-sm font-medium cursor-pointer disabled:opacity-50"
              >
                Регулярне вираження
              </Label>
            </div>
          </div>

          {totalAffected === 0 && findText && !regexError && (
            <p className="text-xs text-muted-foreground">
              Товарів, де знайдено цей рядок, не знайдено.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setFindText("");
                setReplaceText("");
              }}
              disabled={isRenaming}
            >
              Скасувати
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                isRenaming ||
                !findText ||
                !replaceText ||
                (!titleRu && !titleUk) ||
                Boolean(useRegex && regexError)
              }
            >
              {isRenaming ? "Перейменовую…" : "Перейменувати"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
