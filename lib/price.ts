/**
 * Форматирование цены из CSV.
 *
 * В выгрузках цена приходит как `1299.00`. Показываем без незначащих нулей:
 * `1299.00` → `1299`, `1299.50` → `1299.5`, `1299,00` → `1299`.
 * Ненечисловые значения (например, «1299 грн») не трогаем.
 */
export function formatPrice(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^(-?\d[\d\s]*?)(?:([.,])(\d+))?$/);
  if (!match) return trimmed;

  const integer = match[1];
  const separator = match[2];
  const fraction = match[3]?.replace(/0+$/, "") ?? "";

  if (!separator || !fraction) return integer;
  return `${integer}${separator}${fraction}`;
}

/**
 * Цена с символом гривны: `1299.00` → `1299 ₴`.
 * Ненечисловые значения оставляем как есть, чтобы не получить «1299 грн ₴».
 */
export function formatPriceUah(value: string): string {
  const formatted = formatPrice(value);
  if (!formatted) return "";
  return /^[-\d\s.,]+$/.test(formatted) ? `${formatted} ₴` : formatted;
}

/** Разбирает цену в число. Понимает пробелы в тысячах и запятую. */
export function parsePriceNumber(value: string): number | null {
  const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

/** Сводка цен товаров одной группы. */
export interface PriceSummary {
  /** Уникальные непустые цены в исходном виде. */
  values: string[];
  /** Минимальная числовая цена. */
  min: number | null;
  /** Максимальная числовая цена. */
  max: number | null;
  /** У скольких товаров цена отсутствует. */
  missing: number;
  /** Сколько всего товаров участвовало в сводке. */
  total: number;
  /** Все уникальные цены — числа. */
  numeric: boolean;
}

/** Собирает сводку цен по списку значений (включая пустые). */
export function summarizePrices(
  values: Array<string | null | undefined>,
): PriceSummary {
  const nonEmpty = values
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);
  const uniqueValues = [...new Set(nonEmpty)];
  const numbers = uniqueValues
    .map((value) => parsePriceNumber(value))
    .filter((value): value is number => value !== null);

  return {
    values: uniqueValues,
    min: numbers.length > 0 ? Math.min(...numbers) : null,
    max: numbers.length > 0 ? Math.max(...numbers) : null,
    missing: values.length - nonEmpty.length,
    total: values.length,
    numeric: uniqueValues.length > 0 && numbers.length === uniqueValues.length,
  };
}

/** Короткая подпись цены группы: одна цена, диапазон или список. */
export function formatPriceSummary(summary: PriceSummary): string {
  if (summary.values.length === 0) return "ціна не вказана";

  if (summary.numeric && summary.min !== null && summary.max !== null) {
    if (summary.min === summary.max) {
      return formatPriceUah(String(summary.min));
    }
    return `${formatPrice(String(summary.min))}–${formatPriceUah(String(summary.max))}`;
  }

  return summary.values.map((value) => formatPriceUah(value)).join(", ");
}
