import type { CSSProperties } from "react";

/** Допустимая ширина карточки товара в пикселях. */
export const CARD_WIDTH_MIN = 140;
export const CARD_WIDTH_MAX = 400;
export const CARD_WIDTH_STEP = 10;
export const DEFAULT_CARD_WIDTH = 240;

export type CardWidth = number;

const LEGACY_WIDTHS: Record<string, number> = {
  small: 180,
  medium: DEFAULT_CARD_WIDTH,
  large: 340,
};

/** Приводит сохранённое значение к допустимой ширине с шагом 10 px. */
export function normalizeCardWidth(value: unknown): CardWidth {
  if (typeof value === "string" && value in LEGACY_WIDTHS) {
    return LEGACY_WIDTHS[value];
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_CARD_WIDTH;
  const clamped = Math.min(
    CARD_WIDTH_MAX,
    Math.max(CARD_WIDTH_MIN, numeric),
  );
  return Math.round(clamped / CARD_WIDTH_STEP) * CARD_WIDTH_STEP;
}

/** Проверяет, что значение является допустимой шириной карточки. */
export function isCardWidth(value: unknown): value is CardWidth {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= CARD_WIDTH_MIN &&
    value <= CARD_WIDTH_MAX &&
    value % CARD_WIDTH_STEP === 0
  );
}

/** CSS-сетка карточек с выбранной шириной. */
export function cardGridStyle(width: CardWidth): CSSProperties {
  return {
    gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${width}px), ${width}px))`,
    justifyContent: "start",
  };
}
