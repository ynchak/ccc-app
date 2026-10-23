/** Варианты размера карточек товаров. */
export const CARD_SIZE_OPTIONS = [
  { value: "small", label: "Маленькі" },
  { value: "medium", label: "Середні" },
  { value: "large", label: "Великі" },
] as const;

export type CardSize = (typeof CARD_SIZE_OPTIONS)[number]["value"];

/** Размер карточек по умолчанию. */
export const DEFAULT_CARD_SIZE: CardSize = "medium";

/** Проверяет, что значение является допустимым размером карточек. */
export function isCardSize(value: unknown): value is CardSize {
  return CARD_SIZE_OPTIONS.some((option) => option.value === value);
}

/** CSS-классы сетки для выбранного размера карточек. */
export const CARD_GRID_CLASSES: Record<CardSize, string> = {
  small:
    "grid-cols-2 gap-2 min-[480px]:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
  medium:
    "grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4",
  large:
    "grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3",
};
