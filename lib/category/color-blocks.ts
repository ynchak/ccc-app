import type { Product } from "@/lib/types";

/** Один цветовой подблок внутри группы. */
export interface ColorBlock {
  /** Нормализованное значение поля color: trim + нижний регистр. */
  key: string;
  /** Как цвет написан в первом товаре блока. */
  label: string;
  /** Товары блока в исходном порядке. */
  products: Product[];
  /** Товары без заполненного поля color. */
  isMissing: boolean;
}

/** Метка блока для товаров без цвета. */
export const MISSING_COLOR_LABEL = "Без кольору";

function colorKey(product: Product): string {
  return (product.color ?? "").trim().toLocaleLowerCase("uk");
}

/**
 * Разбивает товары группы на цветовые подблоки.
 *
 * Порядок блоков — по первому появлению товара, порядок товаров внутри
 * блока не меняется. Товары без цвета идут отдельным блоком в конце.
 *
 * Значение поля color сравнивается как есть (только регистр и пробелы
 * нормализуются): «Чёрный» и «Black» остаются разными блоками.
 */
export function splitProductsByColor(products: Product[]): ColorBlock[] {
  const blocks = new Map<string, ColorBlock>();
  let missing: ColorBlock | null = null;

  for (const product of products) {
    const key = colorKey(product);

    if (!key) {
      if (!missing) {
        missing = {
          key: "",
          label: MISSING_COLOR_LABEL,
          products: [],
          isMissing: true,
        };
      }
      missing.products.push(product);
      continue;
    }

    const existing = blocks.get(key);
    if (existing) {
      existing.products.push(product);
      continue;
    }

    blocks.set(key, {
      key,
      label: (product.color ?? "").trim(),
      products: [product],
      isMissing: false,
    });
  }

  return [...blocks.values(), ...(missing ? [missing] : [])];
}
