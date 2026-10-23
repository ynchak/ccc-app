import { normalizeTitle, type ClusteredGroup } from "@/lib/grouping/cluster";
import type { ParsedProduct } from "@/lib/types";

/**
 * Слияние групп с одинаковым названием.
 *
 * Правило единое для импорта и ручного переименования: если две группы
 * называются одинаково и относятся к одной категории — они одна группа.
 * Группы из разных категорий не сливаются никогда.
 */

/** Результат слияния. */
export interface MergeResult {
  groups: ClusteredGroup[];
  /** Сколько групп было слито автоматически. */
  mergedCount: number;
}

/**
 * Сливает группы с одинаковым названием внутри категории.
 *
 * @param groups исходные группы
 * @param products все товары (для пересчёта состава и порядка)
 */
export function mergeByTitle(
  groups: ClusteredGroup[],
  products: ParsedProduct[],
): MergeResult {
  const buckets = new Map<string, ClusteredGroup[]>();

  for (const group of groups) {
    const titleKey = group.titleKey || normalizeTitle(group.title);
    const key = `${group.categoryId}\u0000${titleKey}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(group);
    else buckets.set(key, [group]);
  }

  const result: ClusteredGroup[] = [];
  let mergedCount = 0;

  for (const bucket of buckets.values()) {
    if (bucket.length === 1) {
      result.push(bucket[0]);
      continue;
    }

    const target = bucket[0];
    const memberIndexes = bucket
      .flatMap((group) => group.memberIndexes)
      .sort((a, b) => products[a].order - products[b].order);

    result.push({ ...target, memberIndexes });
    mergedCount += bucket.length - 1;
  }

  return { groups: result, mergedCount };
}
