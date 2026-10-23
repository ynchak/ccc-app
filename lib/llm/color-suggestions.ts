import type { Group, Product } from "@/lib/types";

/**
 * Заполняет пустые цвета товаров по исходным фото-группам.
 *
 * Фото-группа считается одноцветной: если в ней есть один уникальный
 * исходный цвет, он переносится на товары без цвета. Если исходных цветов
 * несколько — группа не трогается. Если исходных цветов нет, используется
 * цвет, найденный LLM в названии.
 */
export function applySuggestedColors(
  groups: Iterable<Group>,
  products: Map<number, Product>,
  titleColors: Map<number, string | undefined>,
): {
  products: Map<number, Product>;
  changed: Product[];
  count: number;
} {
  const next = new Map(products);
  const changed: Product[] = [];
  let count = 0;

  for (const group of groups) {
    const groupProducts = group.productIds
      .map((id) => next.get(id))
      .filter((product): product is Product => product !== undefined);

    const sourceColors = [
      ...new Set(
        groupProducts
          .map((product) => product.color?.trim())
          .filter((color): color is string => Boolean(color))
          .map((color) => color.toLocaleLowerCase("uk")),
      ),
    ];
    if (sourceColors.length > 1) continue;

    const sourceColor = groupProducts
      .map((product) => product.color?.trim())
      .find((color): color is string => Boolean(color));
    const color = sourceColor || titleColors.get(group.id)?.trim();
    if (!color) continue;

    for (const product of groupProducts) {
      if (product.color?.trim()) continue;
      const updated = {
        ...product,
        color,
        colorSource: "suggested" as const,
      };
      next.set(product.id, updated);
      changed.push(updated);
      count++;
    }
  }

  return { products: next, changed, count };
}
