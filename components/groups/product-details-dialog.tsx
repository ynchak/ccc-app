"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  ImageNotFound01Icon,
  Refresh01Icon,
  ZoomInAreaIcon,
  ZoomOutIcon,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Product } from "@/lib/types";

/** Одна строка заполненного атрибута. */
function Field({
  label,
  value,
  suggested = false,
}: {
  label: string;
  value: string;
  suggested?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2 text-sm last:border-b-0 sm:border-b-0 sm:py-1.5">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 text-right break-words">
        {value}
        {suggested ? (
          <Badge
            variant="outline"
            className="h-4 shrink-0 border-amber-500/30 bg-amber-500/10 px-1 text-[9px] text-amber-700 dark:text-amber-300"
            title="Колір запропоновано сервісом"
          >
            ШІ
          </Badge>
        ) : null}
      </span>
    </div>
  );
}

/** Слайдер и полноэкранный просмотр фотографий с зумом. */
function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [imageIndex, setImageIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const dragMovedRef = useRef(false);

  const safeIndex = images.length > 0 ? imageIndex % images.length : 0;
  const currentImage = images[safeIndex];
  const imageFailed = currentImage ? failedImages.has(currentImage) : false;

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const setZoomLevel = (next: number) => {
    const value = Math.min(4, Math.max(1, next));
    setZoom(value);
    if (value <= 1) setPan({ x: 0, y: 0 });
  };

  const closeZoom = () => {
    setIsZoomed(false);
    resetZoom();
    dragRef.current = null;
  };

  const showPrev = () => {
    if (images.length < 2) return;
    setImageIndex((index) => (index - 1 + images.length) % images.length);
    resetZoom();
  };

  const showNext = () => {
    if (images.length < 2) return;
    setImageIndex((index) => (index + 1) % images.length);
    resetZoom();
  };

  const handleError = () => {
    if (!currentImage) return;
    setFailedImages((current) => {
      const next = new Set(current);
      next.add(currentImage);
      return next;
    });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragMovedRef.current = false;
    if (zoom <= 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMovedRef.current = true;
    setPan({ x: drag.originX + dx, y: drag.originY + dy });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleImageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    setZoomLevel(zoom + 0.5);
  };

  useEffect(() => {
    if (!isZoomed) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsZoomed(false);
        setZoom(1);
        setPan({ x: 0, y: 0 });
        dragRef.current = null;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isZoomed]);

  return (
    <div className="relative h-72 w-full overflow-hidden rounded-lg bg-muted sm:h-full sm:min-h-80">
      {currentImage && !imageFailed ? (
        <button
          type="button"
          onClick={() => setIsZoomed(true)}
          className="absolute inset-0 flex cursor-zoom-in items-center justify-center p-2"
          aria-label="Збільшити фото"
          title="Натисніть, щоб збільшити"
        >
          <span className="relative block h-full w-full">
            <Image
              src={currentImage}
              alt={title}
              fill
              sizes="(max-width: 640px) 100vw, 640px"
              className="object-contain"
              unoptimized
              draggable={false}
              onError={handleError}
            />
          </span>
        </button>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <HugeiconsIcon icon={ImageNotFound01Icon} className="size-8" />
          {images.length === 0 ? "Немає фото" : "Фото не завантажилося"}
        </div>
      )}

      {currentImage && !imageFailed ? (
        <button
          type="button"
          onClick={() => setIsZoomed(true)}
          className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
          aria-label="Збільшити фото"
          title="Збільшити фото"
        >
          <HugeiconsIcon icon={ZoomInAreaIcon} className="size-4" />
        </button>
      ) : null}

      {images.length > 1 ? (
        <>
          <button
            type="button"
            onClick={showPrev}
            className="absolute top-1/2 left-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur transition-opacity hover:opacity-100"
            aria-label="Попереднє фото"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          </button>
          <button
            type="button"
            onClick={showNext}
            className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur transition-opacity hover:opacity-100"
            aria-label="Наступне фото"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
          </button>
          <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-2 py-0.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
            {safeIndex + 1} / {images.length}
          </span>
        </>
      ) : null}

      {isZoomed && currentImage && !imageFailed && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Перегляд фото"
              onClick={closeZoom}
            >
              <button
                type="button"
                onClick={closeZoom}
                className="absolute top-4 right-4 z-20 flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="Закрити перегляд"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-5" />
              </button>

              <div
                className={`relative h-[90vh] w-[90vw] touch-none overflow-hidden ${
                  zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
                }`}
                onClick={handleImageClick}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                <div
                  className="relative h-full w-full"
                  style={{
                    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                  }}
                >
                  <Image
                    src={currentImage}
                    alt={title}
                    fill
                    sizes="90vw"
                    className="pointer-events-none object-contain select-none"
                    unoptimized
                    draggable={false}
                  />
                </div>
              </div>

              {images.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      showPrev();
                    }}
                    className="absolute top-1/2 left-4 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                    aria-label="Попереднє фото"
                  >
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      showNext();
                    }}
                    className="absolute top-1/2 right-4 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                    aria-label="Наступне фото"
                  >
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" />
                  </button>
                  <span className="pointer-events-none absolute top-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-white/10 px-2.5 py-1 text-xs text-white">
                    {safeIndex + 1} / {images.length}
                  </span>
                </>
              ) : null}

              <div
                className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/55 p-1 text-white backdrop-blur"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setZoomLevel(zoom - 0.5)}
                  disabled={zoom <= 1}
                  className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-white/15 disabled:opacity-40"
                  aria-label="Зменшити"
                >
                  <HugeiconsIcon icon={ZoomOutIcon} className="size-4" />
                </button>
                <span className="min-w-12 text-center text-xs tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <span className="px-1 text-[11px] text-white/60">
                  клік — збільшити
                </span>
                <button
                  type="button"
                  onClick={resetZoom}
                  disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
                  className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-white/15 disabled:opacity-40"
                  aria-label="Скинути масштаб"
                >
                  <HugeiconsIcon icon={Refresh01Icon} className="size-4" />
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
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
  const fields = product
    ? [
        { label: "Артикул", value: product.goodsArticle },
        { label: "Бренд", value: product.producersTitle },
        { label: "Продавець", value: product.sellerTitle },
        { label: "Категорія", value: product.categoryTitle },
        { label: "Розмір", value: product.size },
        {
          label: "Колір",
          value: product.color,
          suggested: product.colorSource === "suggested",
        },
        { label: "Зріст", value: product.height },
        { label: "EAN", value: product.ean },
        { label: "МДГ", value: product.mdg },
      ].filter(
        (
          field,
        ): field is { label: string; value: string; suggested?: boolean } =>
          typeof field.value === "string" && field.value.trim().length > 0,
      )
    : [];
  const description = product?.description?.trim() ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Деталі товару</DialogTitle>
          <DialogDescription>{product?.goodsTitle ?? ""}</DialogDescription>
        </DialogHeader>

        {product ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <ProductGallery
              key={product.id}
              images={product.imageUrls}
              title={product.goodsTitle}
            />

            <div className="flex min-w-0 flex-col gap-4">
              {fields.length > 0 ? (
                <div className="flex flex-col">
                  {fields.map((field) => (
                    <Field
                      key={field.label}
                      label={field.label}
                      value={field.value}
                    />
                  ))}
                </div>
              ) : null}

              {description ? (
                <>
                  <Separator />
                  <div className="flex flex-col gap-1 pb-2">
                    <span className="text-sm text-muted-foreground">
                      Опис
                    </span>
                    <p className="text-sm leading-relaxed whitespace-pre-line">
                      {description}
                    </p>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Закрити
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
