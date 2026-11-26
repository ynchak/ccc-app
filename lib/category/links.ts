import { articleBase } from "@/lib/jev/candidates";
import type { CategoryCluster, Product } from "@/lib/types";

/** Признак, по которому кластеры считаются возможной одной моделью. */
export type ModelLinkKind = "article" | "mdg" | "title";

/** Мягкая связь между кластерами. */
export interface ModelLink {
  clusterId: number;
  number: number;
  kind: ModelLinkKind;
  key: string;
  title: string;
  categoryTitle: string;
  productCount: number;
  /** Первый товар другой группы — для визуального превью. */
  productId: number | null;
  /** Все товары другой группы — чтобы показать, что будет добавлено. */
  productIds: number[];
}

const TITLE_MODEL_RE = /\b[A-Z]{2,}[_-]?\d{2,}\b/gi;
const DIGIT_MODEL_RE = /\b\d{5,}\b/g;

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("uk");
}

function usable(value: string | null | undefined): string {
  const normalized = normalize(value);
  if (
    !normalized ||
    normalized === "<nil>" ||
    normalized === "nil" ||
    normalized === "none" ||
    normalized === "null" ||
    normalized === "0"
  ) {
    return "";
  }
  return normalized;
}

/**
 * Ключи, по которым товары одной модели можно связать между категориями.
 * Это только подсказки: жёстко по ним не объединяем.
 */
export function modelKeys(product: Product): string[] {
  const keys = new Set<string>();
  const article = usable(articleBase(product.goodsArticle));
  if (article.length >= 4) keys.add(`article:${article}`);

  // У вариантов одной модели артикул часто выглядит как 600001265_4.
  // Корень даёт более широкую, но всё ещё полезную подсказку.
  const articleRoot = usable(product.goodsArticle.split(/[-_/]+/)[0]);
  if (articleRoot.length >= 5 && /\d/.test(articleRoot)) {
    keys.add(`article:${articleRoot}`);
  }

  const mdg = usable(product.mdg);
  if (mdg.length >= 4) keys.add(`mdg:${mdg}`);

  const title = product.goodsTitle ?? "";
  for (const match of title.matchAll(TITLE_MODEL_RE)) {
    const token = match[0].toUpperCase();
    if (token.length >= 5) keys.add(`title:${token}`);
  }
  for (const match of title.matchAll(DIGIT_MODEL_RE)) {
    keys.add(`title:${match[0]}`);
  }

  return [...keys];
}

/** Собирает мягкие связи между кластерами. */
export function buildModelLinks(
  clusters: Iterable<CategoryCluster>,
  products: Map<number, Product>,
): Map<number, ModelLink[]> {
  const clusterList = [...clusters];
  const clustersByKey = new Map<string, CategoryCluster[]>();

  for (const cluster of clusterList) {
    const keys = new Set<string>();
    for (const productId of cluster.productIds) {
      const product = products.get(productId);
      if (!product) continue;
      for (const key of modelKeys(product)) keys.add(key);
    }
    for (const key of keys) {
      const list = clustersByKey.get(key);
      if (list) list.push(cluster);
      else clustersByKey.set(key, [cluster]);
    }
  }

  const links = new Map<number, ModelLink[]>();
  for (const [key, keyClusters] of clustersByKey) {
    if (keyClusters.length < 2 || keyClusters.length > 10) continue;
    for (const cluster of keyClusters) {
      const kind = key.slice(0, key.indexOf(":")) as ModelLinkKind;
      for (const other of keyClusters) {
        if (other.id === cluster.id) continue;
        const otherFirst =
          other.productIds
            .map((productId) => products.get(productId))
            .find((product) => product && product.imageUrls.length > 0) ??
          products.get(other.productIds[0]);
        const list = links.get(cluster.id) ?? [];
        if (list.some((link) => link.clusterId === other.id)) {
          continue;
        }
        list.push({
          clusterId: other.id,
          number: other.number,
          kind,
          key: key.slice(key.indexOf(":") + 1),
          title: other.title,
          categoryTitle: otherFirst?.categoryTitle ?? "",
          productCount: other.productIds.length,
          productId: otherFirst?.id ?? null,
          productIds: other.productIds,
        });
        links.set(cluster.id, list);
      }
    }
  }

  for (const list of links.values()) {
    list.sort(
      (a, b) =>
        b.productCount - a.productCount ||
        a.title.localeCompare(b.title, "uk"),
    );
    if (list.length > 5) list.length = 5;
  }

  return links;
}
