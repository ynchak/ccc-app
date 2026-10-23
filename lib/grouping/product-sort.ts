import type { Product } from "@/lib/types";

/** Сортирует товары внутри группы: по цвету, без цвета — по названию. */
export function sortGroupProducts(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    const aColor = a.color?.trim() ?? "";
    const bColor = b.color?.trim() ?? "";

    if (!aColor && !bColor) {
      return (
        a.goodsTitle.localeCompare(b.goodsTitle, "uk", {
          sensitivity: "base",
        }) || a.order - b.order
      );
    }
    if (!aColor) return 1;
    if (!bColor) return -1;

    return (
      aColor.localeCompare(bColor, "uk", { sensitivity: "base" }) ||
      a.order - b.order
    );
  });
}
