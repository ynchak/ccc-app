"use client";

import Image from "next/image";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Product } from "@/lib/types";

/** Одна строка атрибута. */
function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right break-words">
        {value ? value : <span className="text-muted-foreground/60">—</span>}
      </span>
    </div>
  );
}

/**
 * Диалог с полными данными товара.
 */
export function ProductDetailsDialog({
  product,
  open,
  onOpenChange,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const cover = product?.imageUrls[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Деталі товару</DialogTitle>
          <DialogDescription>
            {product?.goodsTitle ?? ""}
          </DialogDescription>
        </DialogHeader>

        {product ? (
          <div className="flex flex-col gap-3">
            {cover ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
                <Image
                  src={cover}
                  alt={product.goodsTitle}
                  fill
                  sizes="600px"
                  className="object-contain"
                  unoptimized
                />
              </div>
            ) : null}

            <div className="grid gap-x-6 sm:grid-cols-2">
              <div>
                <Field label="goods_id" value={product.goodsId} />
                <Field label="goods_article" value={product.goodsArticle} />
                <Field label="goods_title" value={product.goodsTitle} />
                <Field
                  label="producers_title"
                  value={product.producersTitle}
                />
                <Field label="seller_title" value={product.sellerTitle} />
                <Field
                  label="gomer_sync_source_id"
                  value={product.gomerSyncSourceId}
                />
              </div>
              <div>
                <Field label="goods_category_id" value={product.categoryId} />
                <Field
                  label="goods_category_title"
                  value={product.categoryTitle}
                />
                <Field label="Размер" value={product.size} />
                <Field label="Цвет" value={product.color} />
                <Field label="Рост" value={product.height} />
                <Field label="EAN" value={product.ean} />
                <Field label="МДГ" value={product.mdg} />
              </div>
            </div>

            {product.description ? (
              <>
                <Separator />
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">Опис</span>
                  <p className="max-h-48 overflow-y-auto text-sm whitespace-pre-line">
                    {product.description}
                  </p>
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Закрыть
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
