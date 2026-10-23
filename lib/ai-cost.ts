/** Стоимость запроса по данным usage от OpenRouter. */
export function usageCost(usage: unknown): number {
  if (!usage || typeof usage !== "object") return 0;
  const value = (usage as { cost?: unknown }).cost;
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

/** Короткий формат стоимости в долларах. */
export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(value);
}
