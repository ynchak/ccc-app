"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
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
  ZoomOutIcon,
} from "@hugeicons/core-free-icons";

/**
 * Полноэкранный просмотр фото с зумом.
 *
 * Клик по фото увеличивает, кнопка «−» уменьшает. Компонент рендерится
 * только когда просмотр открыт, поэтому состояние всегда начинается с 100%.
 */
export function ProductImageLightbox({
  images,
  title,
  initialIndex,
  onClose,
}: {
  images: string[];
  title: string;
  initialIndex: number;
  onClose: () => void;
}) {
  const [imageIndex, setImageIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0)),
  );
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const dragMovedRef = useRef(false);

  const currentImage = images[imageIndex];
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

  const handleImageClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    setZoomLevel(zoom + 0.5);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фото"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-20 flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        aria-label="Закрыть просмотр"
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
        {currentImage && !imageFailed ? (
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
              onError={handleError}
            />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-white/70">
            <HugeiconsIcon icon={ImageNotFound01Icon} className="size-8" />
            Фото не загрузилось
          </div>
        )}
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
            aria-label="Предыдущее фото"
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
            aria-label="Следующее фото"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" />
          </button>
          <span className="pointer-events-none absolute top-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-white/10 px-2.5 py-1 text-xs text-white">
            {imageIndex + 1} / {images.length}
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
          aria-label="Уменьшить"
        >
          <HugeiconsIcon icon={ZoomOutIcon} className="size-4" />
        </button>
        <span className="min-w-12 text-center text-xs tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <span className="px-1 text-[11px] text-white/60">
          клик — увеличить
        </span>
        <button
          type="button"
          onClick={resetZoom}
          disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
          className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-white/15 disabled:opacity-40"
          aria-label="Сбросить масштаб"
        >
          <HugeiconsIcon icon={Refresh01Icon} className="size-4" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
