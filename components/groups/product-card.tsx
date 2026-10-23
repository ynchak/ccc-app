"use client";

import { memo, useState, type DragEvent, type MouseEvent } from "react";
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
import { PRODUCT_DRAG_TYPE, setDragIds } from "@/lib/dnd";
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

  const images = product.imageUrls;
  const safeIndex = images.length > 0 ? imageIndex % images.length : 0;
  const currentImage = images[safeIndex];
  const imageFailed = currentImage ? failedImages.has(currentImage) : false;
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
          className="absolute inset-0 flex items-center justify-center p-2"
          onClick={() => onDetails(product)}
          aria-label={`Открыть товар ${product.goodsTitle}`}
        >
          {currentImage && !imageFailed ? (
            <span className="relative block h-full w-full">
              <Image
                src={currentImage}
                alt={product.goodsTitle}
                fill
                sizes="(max-width: 640px) 100vw, 320px"
                className="object-contain"
                unoptimized
                draggable={false}
                onError={handleImageError}
              />
            </span>
          ) : (
            <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
              <HugeiconsIcon icon={ImageNotFound01Icon} className="size-6" />
              {images.length === 0 ? "Нет фото" : "Фото не загрузилось"}
            </div>
          )}
        </button>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-2">
          <div className="pointer-events-auto rounded-md bg-background/90 p-1 shadow-sm backdrop-blur">
            <Checkbox
              checked={selected}
              onCheckedChange={() => toggleProductSelection(product.id)}
              aria-label={`Выбрать товар ${product.goodsTitle}`}
            />
          </div>

          <div className="pointer-events-auto flex items-center gap-1">
            <button
              type="button"
              className="flex size-7 cursor-grab items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm backdrop-blur hover:text-foreground active:cursor-grabbing"
              draggable
              onDragStart={handleDragStart}
              aria-label="Перетащить товар"
              title="Перетащить товар в другую группу"
            >
              <HugeiconsIcon icon={GripVerticalIcon} className="size-4" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    className="bg-background/90 shadow-sm backdrop-blur"
                    aria-label="Действия с товаром"
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
                    Детали
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onMove(product)}>
                    <HugeiconsIcon
                      icon={MoveHorizontalIcon}
                      data-icon="inline-start"
                    />
                    Перенести в группу…
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => void removeProductFromGroup(product.id)}
                  >
                    <HugeiconsIcon
                      icon={UnfoldMoreIcon}
                      data-icon="inline-start"
                    />
                    Вынести в отдельную группу
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
                  {selected ? "Снять выбор" : "Выбрать товар"}
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
              className="absolute top-1/2 left-2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground opacity-80 shadow-sm backdrop-blur transition-opacity hover:opacity-100 focus-visible:opacity-100"
              aria-label="Предыдущее фото"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={handleNextImage}
              className="absolute top-1/2 right-2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground opacity-80 shadow-sm backdrop-blur transition-opacity hover:opacity-100 focus-visible:opacity-100"
              aria-label="Следующее фото"
            >
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
            </button>

            <span className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-background/90 px-2 py-0.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
              {safeIndex + 1} / {images.length}
            </span>
          </>
        ) : null}

        {images.length === 0 ? (
          <span className="absolute right-2 bottom-2 z-10 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
            нет фото
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <button
          type="button"
          className="text-left"
          onClick={() => onDetails(product)}
        >
          <p
            className="text-xs leading-snug font-medium break-words hover:underline hover:decoration-dotted hover:underline-offset-4"
            title={product.goodsTitle}
          >
            {product.goodsTitle}
          </p>
        </button>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border bg-muted/30 px-2.5 py-2 text-xs">
          <dt className="text-muted-foreground">Бренд</dt>
          <dd
            className="truncate text-foreground"
            title={product.producersTitle || "—"}
          >
            {product.producersTitle || "—"}
          </dd>

          <dt className="text-muted-foreground">Продавец</dt>
          <dd
            className="truncate text-foreground"
            title={product.sellerTitle || "—"}
          >
            {product.sellerTitle || "—"}
          </dd>

          <dt className="text-muted-foreground">Размер</dt>
          <dd className="truncate text-foreground" title={product.size ?? "—"}>
            {product.size || "—"}
          </dd>

          {product.height ? (
            <>
              <dt className="text-muted-foreground">Рост</dt>
              <dd
                className="truncate text-foreground"
                title={product.height}
              >
                {product.height}
              </dd>
            </>
          ) : null}

          <dt className="text-muted-foreground">Цвет</dt>
          <dd className="truncate text-foreground" title={product.color ?? "—"}>
            {product.color || "—"}
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
          {gomerUrl ? (
            <a
              href={gomerUrl}
              target="_blank"
              rel="noreferrer"
              className={`${buttonVariants({
                variant: "outline",
                size: "xs",
              })} text-muted-foreground hover:text-foreground`}
              title="Открыть товар в Gomer"
            >
              Gomer
            </a>
          ) : (
            <span
              className={`${buttonVariants({
                variant: "outline",
                size: "xs",
              })} cursor-default text-muted-foreground/50`}
              title="Нет gomer_sync_source_id"
            >
              Gomer
            </span>
          )}

          {rozetkaUrl ? (
            <a
              href={rozetkaUrl}
              target="_blank"
              rel="noreferrer"
              className={`${buttonVariants({
                variant: "outline",
                size: "xs",
              })} text-muted-foreground hover:text-foreground`}
              title="Открыть товар на Rozetka"
            >
              RZ
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
});
