import {
  capitalizeTitle,
  unescapeTitle,
} from "@/lib/grouping/title-text";
import type { ParsedProduct } from "@/lib/types";

/**
 * Кластеризация товаров по фотографиям.
 *
 * Два товара относятся к одной группе, если у них достаточно большая доля
 * общих фото. Сравнение идёт внутри одной категории: товары из разных
 * категорий не объединяются никогда.
 *
 * Одного общего фото из большого набора недостаточно: это часто бывает у
 * похожих, но разных моделей. Считаем долю общих фото от меньшего набора.
 */

/** Минимальная доля общих фото для объединения. */
export const PHOTO_OVERLAP_THRESHOLD = 0.8;

/** Кластер товаров. */
export interface Cluster {
  /** Индексы товаров в переданном массиве. */
  memberIndexes: number[];
}

/** Структура union-find. */
class UnionFind {
  private parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }

  find(x: number): number {
    let root = x;
    while (this.parent[root] !== root) root = this.parent[root];
    // Сжатие путей.
    while (this.parent[x] !== root) {
      const next = this.parent[x];
      this.parent[x] = root;
      x = next;
    }
    return root;
  }

  /** Возвращает true, если элементы уже в одной компоненте. */
  union(a: number, b: number): boolean {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return false;
    this.parent[rootB] = rootA;
    return true;
  }
}

/** Проверяет, достаточно ли общих фото для объединения. */
export function hasStrongPhotoOverlap(
  sharedCount: number,
  firstCount: number,
  secondCount: number,
): boolean {
  const minCount = Math.min(firstCount, secondCount);
  return minCount > 0 && sharedCount / minCount >= PHOTO_OVERLAP_THRESHOLD;
}

/**
 * Группирует товары по общим ссылкам на фото.
 *
 * Сначала считаем количество общих фото для каждой пары товаров внутри
 * категории. Затем объединяем только пары, у которых доля общих фото
 * достигает PHOTO_OVERLAP_THRESHOLD.
 */
export function clusterByPhotos(products: ParsedProduct[]): Cluster[] {
  const uf = new UnionFind(products.length);
  const photoSets = products.map(
    (product) => new Set(product.imageUrls.filter(Boolean)),
  );
  const urlIndex = new Map<string, number[]>();

  products.forEach((product, index) => {
    for (const url of photoSets[index]) {
      const list = urlIndex.get(url);
      if (list) list.push(index);
      else urlIndex.set(url, [index]);
    }
  });

  const sharedCounts = new Map<number, number>();
  const pairKey = (a: number, b: number) =>
    Math.min(a, b) * products.length + Math.max(a, b);

  for (const indexes of urlIndex.values()) {
    if (indexes.length < 2) continue;

    // Один URL может встречаться в разных категориях.
    const byCategory = new Map<string, number[]>();
    for (const index of indexes) {
      const categoryId = products[index].categoryId;
      const list = byCategory.get(categoryId);
      if (list) list.push(index);
      else byCategory.set(categoryId, [index]);
    }

    for (const categoryIndexes of byCategory.values()) {
      for (let i = 0; i < categoryIndexes.length; i++) {
        for (let j = i + 1; j < categoryIndexes.length; j++) {
          const key = pairKey(categoryIndexes[i], categoryIndexes[j]);
          sharedCounts.set(key, (sharedCounts.get(key) ?? 0) + 1);
        }
      }
    }
  }

  for (const [key, sharedCount] of sharedCounts) {
    const first = Math.floor(key / products.length);
    const second = key % products.length;
    if (
      hasStrongPhotoOverlap(
        sharedCount,
        photoSets[first].size,
        photoSets[second].size,
      )
    ) {
      uf.union(first, second);
    }
  }

  const clusters = new Map<number, number[]>();
  products.forEach((_, index) => {
    const root = uf.find(index);
    const list = clusters.get(root);
    if (list) list.push(index);
    else clusters.set(root, [index]);
  });

  // Порядок внутри кластера — как в исходном файле.
  return [...clusters.values()].map((memberIndexes) => ({
    memberIndexes: memberIndexes.sort(
      (a, b) => products[a].order - products[b].order,
    ),
  }));
}

/** Собирает кластеры в готовые группы (без слияния по названию). */
export interface ClusteredGroup {
  memberIndexes: number[];
  title: string;
  titleRaw: string;
  titleKey: string;
  categoryId: string;
  categoryTitle: string;
}

/** Нормализует название для сравнения: пробелы и регистр не важны. */
export function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Название группы по умолчанию — исходный заголовок первого товара. */
export function defaultGroupTitle(product: ParsedProduct): string {
  return capitalizeTitle(
    unescapeTitle(
      product.goodsTitle || product.goodsArticle || product.goodsId,
    ),
  );
}

/**
 * Превращает кластеры в группы: название берётся из первого товара группы
 * без какой-либо очистки.
 */
export function toGroups(
  clusters: Cluster[],
  products: ParsedProduct[],
): ClusteredGroup[] {
  return clusters.map((cluster) => {
    const first = products[cluster.memberIndexes[0]];
    const title = defaultGroupTitle(first);
    return {
      memberIndexes: cluster.memberIndexes,
      title,
      titleRaw: unescapeTitle(first.goodsTitle),
      titleKey: normalizeTitle(title),
      categoryId: first.categoryId,
      categoryTitle: first.categoryTitle,
    };
  });
}
