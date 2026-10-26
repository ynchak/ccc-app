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
