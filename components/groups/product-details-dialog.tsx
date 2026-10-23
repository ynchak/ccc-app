"use client";

import { useState } from "react";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ImageNotFound01Icon,
} from "@hugeicons/core-free-icons";

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
    <div className="flex items-start justify-between gap-4 border-b py-2 text-sm last:border-b-0 sm:border-b-0 sm:py-1.5">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right break-words">
        {value ? value : <span className="text-muted-foreground/60">—</span>}
      </span>
    </div>
  );
}

/** Слайдер фотографий товара. */
function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [imageIndex, setImageIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const safeIndex = images.length > 0 ? imageIndex % images.length : 0;
  const currentImage = images[safeIndex];
  const imageFailed = currentImage ? failedImages.has(currentImage) : false;

  const showPrev = () => {
    if (images.length < 2) return;
    setImageIndex((index) => (index - 1 + images.length) % images.length);
  };

  const showNext = () => {
    if (images.length < 2) return;
    setImageIndex((index) => (index + 1) % images.length);
  };

  const handleError = () => {
    if (!currentImage) return;
    setFailedImages((current) => {
      const next = new Set(current);
      next.add(currentImage);
      return next;
    });
  };

  return (
    <div className="relative h-72 w-full overflow-hidden rounded-lg bg-muted sm:h-80">
      {currentImage && !imageFailed ? (
        <Image
          src={currentImage}
          alt={title}
          fill
          sizes="(max-width: 640px) 100vw, 640px"
          className="object-contain"
          unoptimized
          onError={handleError}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <HugeiconsIcon icon={ImageNotFound01Icon} className="size-8" />
          {images.length === 0 ? "Нет фото" : "Фото не загрузилось"}
        </div>
      )}

      {images.length > 1 ? (
        <>
          <button
            type="button"
            onClick={showPrev}
            className="absolute top-1/2 left-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur transition-opacity hover:opacity-100"
            aria-label="Предыдущее фото"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          </button>
          <button
            type="button"
            onClick={showNext}
            className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur transition-opacity hover:opacity-100"
            aria-label="Следующее фото"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
          </button>
          <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-2 py-0.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
            {safeIndex + 1} / {images.length}
          </span>
        </>
      ) : null}
    </div>
  );
}

/**
 * Диалог с фотографиями, характеристиками и описанием товара.
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Детали товара</DialogTitle>
          <DialogDescription>{product?.goodsTitle ?? ""}</DialogDescription>
        </DialogHeader>

        {product ? (
          <div className="flex flex-col gap-4">
            <ProductGallery
              key={product.id}
              images={product.imageUrls}
              title={product.goodsTitle}
            />

            <div className="grid gap-x-6 sm:grid-cols-2">
              <div>
                <Field label="Артикул" value={product.goodsArticle} />
                <Field label="Бренд" value={product.producersTitle} />
                <Field label="Продавец" value={product.sellerTitle} />
                <Field label="Категория" value={product.categoryTitle} />
              </div>
              <div>
                <Field label="Размер" value={product.size} />
                <Field label="Цвет" value={product.color} />
                <Field label="Рост" value={product.height} />
                <Field label="EAN" value={product.ean} />
                <Field label="МДГ" value={product.mdg} />
              </div>
            </div>

            <Separator />
            <div className="flex flex-col gap-1 pb-2">
              <span className="text-sm text-muted-foreground">Описание</span>
              <p className="text-sm leading-relaxed whitespace-pre-line">
                {product.description || "Описание отсутствует."}
              </p>
            </div>
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
