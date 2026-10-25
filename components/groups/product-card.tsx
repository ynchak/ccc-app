"use client";

import { memo, useState, type DragEvent, type MouseEvent } from "react";
import { cn } from "cn";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  GripVerticalIcon,
  ImageNotFound01Icon,
  InformationCircleIcon,
  MoveHorizontalIcon,
  MoreHorizontalIcon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProductImageLightbox } from "@/components/groups/product-image-lightbox";
import { PRODUCT_DRAG_TYPE, setDragIds } from "@/lib/dnd";
import { cardImageUrl } from "@/lib/product-images";
import { gomerProductUrl, rozetkaProductUrl } from "@/lib/product-links";
import { useAppStore } from "@/lib/store/app-store";
import type { Product } from "@/lib/types";

/**
 * Карточка товара: слайдер фото, название и таблица характеристик.
 */
export const ProductCard = memo(function ProductCard({
  product,
  onMove,
  onDetails,
}: {
  product: Product;
  onMove: (product: Product) => void;
  onDetails: (product: Product) => void;
}) {
  const selected = useAppStore((s) => s.selectedProductIds.has(product.id));
  const toggleProductSelection = useAppStore((s) => s.toggleProductSelection);
  const removeProductFromGroup = useAppStore((s) => s.removeProductFromGroup);

  const [imageIndex, setImageIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [variantFailedImages, setVariantFailedImages] = useState<Set<string>>(
    new Set(),
  );
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const images = product.imageUrls;
  const safeIndex = images.length > 0 ? imageIndex % images.length : 0;
  const currentImage = images[safeIndex];
  const imageFailed = currentImage ? failedImages.has(currentImage) : false;
  // Для карточки берём уменьшенный вариант с CDN; оригинал остаётся
  // в лайтбоксе и в деталях товара.
  const cardSrc = currentImage
    ? variantFailedImages.has(currentImage)
      ? currentImage
      : cardImageUrl(currentImage)
    : "";
  const gomerUrl = gomerProductUrl(product);
  const rozetkaUrl = rozetkaProductUrl(product.goodsId);

  const handleDragStart = (event: DragEvent<HTMLButtonElement>) => {
    const state = useAppStore.getState();
    const ids =
      selected && state.selectedProductIds.size > 1
        ? [...state.selectedProductIds]
        : [product.id];
    setDragIds(event, PRODUCT_DRAG_TYPE, ids);
  };

  const handlePrevImage = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (images.length < 2) return;
    setImageIndex((index) => (index - 1 + images.length) % images.length);
  };

  const handleNextImage = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (images.length < 2) return;
    setImageIndex((index) => (index + 1) % images.length);
  };

  const handleImageError = () => {
    if (!currentImage) return;

    // Уменьшенного варианта могло не оказаться — один раз пробуем оригинал.
    if (cardSrc !== currentImage) {
      setVariantFailedImages((current) => {
        const next = new Set(current);
        next.add(currentImage);
        return next;
      });
      return;
    }

    setFailedImages((current) => {
      const next = new Set(current);
      next.add(currentImage);
      return next;
    });
  };

  return (
    <div
      className={`relative isolate flex flex-col overflow-hidden rounded-xl border bg-card transition-colors ${
        selected
          ? "border-foreground/30 ring-2 ring-foreground/10"
          : "border-border hover:border-foreground/20"
      }`}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        <button
          type="button"
          className="absolute inset-0 flex cursor-zoom-in items-center justify-center p-0 disabled:cursor-default"
          onClick={() => setLightboxOpen(true)}
          disabled={!currentImage || imageFailed}
          aria-label="Збільшити фото"
          title="Натисніть, щоб збільшити"
        >
          {currentImage && !imageFailed ? (
            <span className="relative block h-full w-full">
              <Image
                src={cardSrc}
                alt={product.goodsTitle}
                fill
                sizes="(max-width: 640px) 100vw, 320px"
                className="object-cover"
                unoptimized
                decoding="async"
                draggable={false}
                onError={handleImageError}
              />
            </span>
          ) : (
            <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
              <HugeiconsIcon icon={ImageNotFound01Icon} className="size-6" />
              {images.length === 0 ? "Немає фото" : "Фото не завантажилося"}
            </div>
          )}
        </button>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-2">
          <div className="pointer-events-auto rounded-md bg-background/95 p-1">
            <Checkbox
              checked={selected}
              onCheckedChange={() => toggleProductSelection(product.id)}
              aria-label={`Вибрати товар ${product.goodsTitle}`}
            />
          </div>

          <div className="pointer-events-auto flex items-center gap-1">
            <button
              type="button"
              className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md bg-background/95 text-muted-foreground hover:text-foreground active:cursor-grabbing"
              draggable
              onDragStart={handleDragStart}
              aria-label="Перетягнути товар"
              title="Перетягніть товар до іншої групи"
            >
              <HugeiconsIcon icon={GripVerticalIcon} className="size-4" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    className="bg-background/95"
                    aria-label="Дії з товаром"
                  />
                }
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => onDetails(product)}>
                    <HugeiconsIcon
                      icon={InformationCircleIcon}
                      data-icon="inline-start"
                    />
                    Деталі
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onMove(product)}>
                    <HugeiconsIcon
                      icon={MoveHorizontalIcon}
                      data-icon="inline-start"
                    />
                    Перемістити до групи…
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => void removeProductFromGroup(product.id)}
                  >
                    <HugeiconsIcon
                      icon={UnfoldMoreIcon}
                      data-icon="inline-start"
                    />
                    Винести в окрему групу
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => toggleProductSelection(product.id)}
                >
                  <HugeiconsIcon
                    icon={CheckmarkCircle01Icon}
                    data-icon="inline-start"
                  />
                  {selected ? "Зняти вибір" : "Вибрати товар"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={handlePrevImage}
              className="absolute top-1/2 left-2 z-10 flex size-7 shrink-0 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background/95 text-foreground opacity-80 transition-opacity hover:opacity-100 focus-visible:opacity-100"
              aria-label="Попереднє фото"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={handleNextImage}
              className="absolute top-1/2 right-2 z-10 flex size-7 shrink-0 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background/95 text-foreground opacity-80 transition-opacity hover:opacity-100 focus-visible:opacity-100"
              aria-label="Наступне фото"
            >
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
            </button>

            <span className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border/60 bg-background/95 px-2 py-0.5 text-[11px] text-muted-foreground">
              {safeIndex + 1} / {images.length}
            </span>
          </>
        ) : null}

        {images.length === 0 ? (
          <span className="absolute right-2 bottom-2 z-10 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
            немає фото
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <p
          className="text-xs leading-snug font-medium break-words"
          title={product.goodsTitle}
        >
          {product.goodsTitle}
        </p>

        {product.producersTitle || product.sellerTitle ? (
          <div className="flex flex-wrap gap-1">
            {product.producersTitle ? (
              <Badge
                variant="secondary"
                className="max-w-full text-[11px]"
                title={`Бренд: ${product.producersTitle}`}
              >
                {product.producersTitle}
              </Badge>
            ) : null}
            {product.sellerTitle ? (
              <Badge
                variant="outline"
                className="max-w-full text-[11px] text-muted-foreground"
                title={`Продавець: ${product.sellerTitle}`}
              >
                {product.sellerTitle}
              </Badge>
            ) : null}
          </div>
        ) : null}

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border bg-muted/30 px-2.5 py-2 text-xs">
          <dt className="text-muted-foreground">Розмір</dt>
          <dd className="truncate text-foreground" title={product.size ?? "—"}>
            {product.size || "—"}
          </dd>

          {product.height ? (
            <>
              <dt className="text-muted-foreground">Зріст</dt>
              <dd
                className="truncate text-foreground"
                title={product.height}
              >
                {product.height}
              </dd>
            </>
          ) : null}

          <dt className="text-muted-foreground">Колір</dt>
          <dd
            className="flex min-w-0 items-center gap-1 text-foreground"
            title={
              product.colorSource === "suggested"
                ? `${product.color} (запропоновано)`
                : (product.color ?? "—")
            }
          >
            <span className="truncate">{product.color || "—"}</span>
            {product.colorSource === "suggested" ? (
              <Badge
                variant="outline"
                className="h-4 shrink-0 border-amber-500/30 bg-amber-500/10 px-1 text-[9px] text-amber-700 dark:text-amber-300"
                title="Колір запропоновано сервісом"
              >
                ШІ
              </Badge>
            ) : null}
          </dd>
        </dl>

        {product.goodsArticle ? (
          <p
            className="truncate text-[11px] text-muted-foreground/70"
            title={product.goodsArticle}
          >
            {product.goodsArticle}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <Button
            variant="outline"
            size="xs"
            onClick={() => onDetails(product)}
            className="text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={InformationCircleIcon} data-icon="inline-start" />
            Деталі
          </Button>

          {gomerUrl ? (
            <a
              href={gomerUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "xs" }),
                "border-orange-500/30 bg-orange-500/15 text-orange-950 hover:bg-orange-500/25 hover:text-orange-950 dark:border-orange-400/30 dark:bg-orange-400/15 dark:text-orange-50 dark:hover:bg-orange-400/25",
              )}
              title="Відкрити товар у Gomer"
            >
              Gomer
            </a>
          ) : (
            <span
              className={cn(
                buttonVariants({ variant: "outline", size: "xs" }),
                "cursor-default border-orange-500/20 bg-orange-500/10 text-orange-950/50 dark:border-orange-400/20 dark:bg-orange-400/10 dark:text-orange-50/50",
              )}
              title="Немає gomer_sync_source_id"
            >
              Gomer
            </span>
          )}

          {rozetkaUrl ? (
            <a
              href={rozetkaUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "xs" }),
                "border-emerald-500/30 bg-emerald-500/15 text-emerald-950 hover:bg-emerald-500/25 hover:text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-400/15 dark:text-emerald-50 dark:hover:bg-emerald-400/25",
              )}
              title="Відкрити товар на Rozetka"
            >
              RZ
            </a>
          ) : null}
        </div>
      </div>

      {lightboxOpen && images.length > 0 ? (
        <ProductImageLightbox
          images={images}
          title={product.goodsTitle}
          initialIndex={safeIndex}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </div>
  );
});
