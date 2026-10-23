import type { ParsedProduct } from "@/lib/types";

/**
 * Кластеризация товаров по фотографиям.
 *
 * Два товара относятся к одной группе, если у них есть хотя бы одна общая
 * ссылка на фото. Сравнение идёт внутри одной категории: товары из разных
 * категорий не объединяются никогда.
 *
 * Инвертированный индекс URL → товары позволяет не перебирать все пары, а
 * смотреть только товары, у которых реально есть общий URL.
 */

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

/**
 * Группирует товары по общим ссылкам на фото.
 *
 * Каждый URL даёт набор товаров. Внутри одной категории все товары с этим URL
 * попадают в один кластер. Разные URL связывают кластеры транзитивно.
 */
export function clusterByPhotos(products: ParsedProduct[]): Cluster[] {
  const uf = new UnionFind(products.length);
  const urlIndex = new Map<string, number[]>();

  products.forEach((product, index) => {
    for (const url of new Set(product.imageUrls)) {
      if (!url) continue;
      const list = urlIndex.get(url);
      if (list) list.push(index);
      else urlIndex.set(url, [index]);
    }
  });

  for (const indexes of urlIndex.values()) {
    if (indexes.length < 2) continue;

    // Один и тот же URL может встречаться в разных категориях. Объединяем
    // только товары внутри категории.
    const byCategory = new Map<string, number[]>();
    for (const index of indexes) {
      const categoryId = products[index].categoryId;
      const list = byCategory.get(categoryId);
      if (list) list.push(index);
      else byCategory.set(categoryId, [index]);
    }

    for (const categoryIndexes of byCategory.values()) {
      for (let i = 1; i < categoryIndexes.length; i++) {
        uf.union(categoryIndexes[0], categoryIndexes[i]);
      }
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
  return product.goodsTitle || product.goodsArticle || product.goodsId;
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
      titleRaw: first.goodsTitle,
      titleKey: normalizeTitle(title),
      categoryId: first.categoryId,
      categoryTitle: first.categoryTitle,
    };
  });
}
