import type { Product, ProductSort } from "@/lib/types";

/** Сортирует товары внутри группы для отображения. */
export function sortGroupProducts(
  products: Product[],
  sort: ProductSort,
): Product[] {
  const result = [...products];
  if (sort === "order") {
    return result.sort((a, b) => a.order - b.order);
  }

  return result.sort((a, b) => {
    const aColor = a.color?.trim() ?? "";
    const bColor = b.color?.trim() ?? "";

    if (!aColor && !bColor) return a.order - b.order;
    if (!aColor) return 1;
    if (!bColor) return -1;

    return (
      aColor.localeCompare(bColor, "uk", { sensitivity: "base" }) ||
      a.order - b.order
    );
  });
}
