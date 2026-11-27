"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";

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
import { useCategoryStore } from "@/lib/store/category-store";
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
  const [isRenaming, setIsRenaming] = useState(false);

  // Подсчёт товаров, в которых встречается findText
  const totalAffected = useMemo(() => {
    if (!findText) return 0;
    let count = 0;
    for (const clusterId of clusterIds) {
      const cluster = clusters.get(clusterId);
      if (!cluster) continue;
      for (const productId of cluster.productIds) {
        const product = products.get(productId);
        if (!product) continue;
        const hasRu = titleRu && product.goodsTitle?.includes(findText);
        const hasUk = titleUk && product.goodsTitleUk?.includes(findText);
        if (hasRu || hasUk) count++;
      }
    }
    return count;
  }, [clusterIds, clusters, products, findText, titleRu, titleUk]);

  const handleSave = async () => {
    if (!findText) return;
    setIsRenaming(true);
    try {
      const count = await renameClustersBatch(clusterIds, findText, replaceText, {
        titleRu,
        titleUk,
      });
      if (count > 0) {
        onOpenChange(false);
        setFindText("");
        setReplaceText("");
      }
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
            <Label htmlFor="find-text">Замінити рядок</Label>
            <Input
              id="find-text"
              value={findText}
              onChange={(event) => setFindText(event.target.value)}
              placeholder="Наприклад: Нижня Білизна Жіноча Сіра"
              aria-label="Текст для заміни"
              className="w-full"
            />
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
          </div>

          {totalAffected === 0 && findText && (
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
                (!titleRu && !titleUk)
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
