import type { ParsedProduct } from "@/lib/types";

/** Форматирует дату импорта как ДД.ММ.ГГГГ. */
export function formatDatasetDate(timestamp: number): string {
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

/** Убирает из имени продавца символы, недопустимые в имени файла. */
function sanitizeSeller(value: string): string {
  return value
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Название импортированного файла: продавец, количество товаров и дата.
 *
 * Если в файле несколько разных seller_title (или поле пустое), вместо
 * продавца используется `all`.
 */
export function datasetNameFromProducts(
  products: Pick<ParsedProduct, "sellerTitle">[],
  importedAt: number,
): string {
  const sellers = new Set(
    products
      .map((product) => product.sellerTitle.trim())
      .filter((seller) => seller.length > 0),
  );
  const seller = sellers.size === 1 ? sanitizeSeller([...sellers][0]) : "all";
  return `${seller || "all"}_${products.length}_${formatDatasetDate(importedAt)}`;
}
