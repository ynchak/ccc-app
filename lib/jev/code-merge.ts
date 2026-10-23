import type { Group, Product } from "@/lib/types";
import { articleBase } from "@/lib/jev/candidates";

const MISSING_VALUES = new Set([
  "",
  "<nil>",
  "nil",
  "none",
  "null",
  "undefined",
  "—",
  "-",
]);

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("uk");
}

function usableCode(value: string | null | undefined): string {
  const normalized = normalize(value);
  return MISSING_VALUES.has(normalized) ? "" : normalized;
}

function brandFor(products: Product[]): string | null {
  const brands = new Set(
    products
      .map((product) => usableCode(product.producersTitle))
      .filter(Boolean),
  );
  if (brands.size > 1) return null;
  return brands.size === 1 ? [...brands][0] : "";
}

function articleCodeFor(products: Product[]): string | null {
  const codes = new Set(
    products
      .map((product) => usableCode(articleBase(product.goodsArticle)))
      .filter(Boolean),
  );
  if (codes.size !== 1) return null;
  return [...codes][0];
}

/**
 * Объединяет группы с одинаковым articleBase в одной категории и бренде.
 *
 * Если бренд отсутствует у обеих групп, разрешаем объединение по
 * категории и коду. Если хотя бы у одной группы есть бренд, а у другой нет,
 * автоматически не объединяем.
 */
export function mergeGroupsByArticleCode(
  groups: Map<number, Group>,
  products: Map<number, Product>,
): { groups: Map<number, Group>; merged: number } {
  const buckets = new Map<string, Group[]>();

  for (const group of groups.values()) {
    if (group.manual || group.titleSource === "manual") continue;
    const groupProducts = group.productIds
      .map((id) => products.get(id))
      .filter((product): product is Product => product !== undefined);
    if (groupProducts.length === 0) continue;

    const code = articleCodeFor(groupProducts);
    if (!code) continue;
    const brand = brandFor(groupProducts);
    if (brand === null) continue;

    const key = `${group.categoryId}\u0000${brand}\u0000${code}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(group);
    else buckets.set(key, [group]);
  }

  const next = new Map(groups);
  let merged = 0;
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;
    bucket.sort((a, b) => a.number - b.number);
    const target = bucket[0];
    const productIds = bucket
      .flatMap((group) => group.productIds)
      .sort(
        (a, b) =>
          (products.get(a)?.order ?? 0) - (products.get(b)?.order ?? 0),
      );
    next.set(target.id, { ...target, productIds });
    for (const source of bucket.slice(1)) {
      next.delete(source.id);
      merged++;
    }
  }

  return { groups: next, merged };
}
