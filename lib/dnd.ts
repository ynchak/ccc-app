import type { DragEvent } from "react";

export const PRODUCT_DRAG_TYPE = "application/x-ccc-products";
export const GROUP_DRAG_TYPE = "application/x-ccc-groups";

/** Проверяет, есть ли в переносимых данных нужный тип. */
export function hasDragType(event: DragEvent, type: string): boolean {
  return Array.from(event.dataTransfer.types).includes(type);
}

/** Кладёт id в dataTransfer. */
export function setDragIds(
  event: DragEvent,
  type: string,
  ids: number[],
): void {
  event.dataTransfer.setData(type, JSON.stringify(ids));
  event.dataTransfer.effectAllowed = "move";
}

/** Достаёт id из dataTransfer. */
export function readDragIds(event: DragEvent, type: string): number[] {
  const raw = event.dataTransfer.getData(type);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
  } catch {
    return [];
  }
}
