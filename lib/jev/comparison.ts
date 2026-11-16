import { sortGroupProducts } from "@/lib/grouping/product-sort";
import { parsePriceNumber } from "@/lib/price";
import type { Group, Product } from "@/lib/types";
import { articleBase } from "@/lib/jev/candidates";

/** Товар группы для превью в сравнении. */
export interface ComparisonProduct {
  id: number;
  title: string;
  price: string | null;
  size: string | null;
  color: string | null;
  images: string[];
}

/** Данные одной группы для сравнительной карточки. */
export interface ComparisonSide {
  id: number;
  number: number;
  title: string;
  count: number;
  brands: string[];
  sellers: string[];
  articles: string[];
  articleBases: string[];
  mdgs: string[];
  sizes: string[];
  colors: string[];
  prices: string[];
  products: ComparisonProduct[];
}

/** Общие и различные признаки пары групп. */
export interface GroupComparison {
  a: ComparisonSide;
  b: ComparisonSide;
  common: {
    brands: string[];
    sellers: string[];
    articleBases: string[];
    mdgs: string[];
    category: string;
    prices: string[];
  };
  differences: {
    titles: boolean;
    articles: boolean;
    colors: boolean;
    sizes: boolean;
    prices: boolean;
  };
}

const MAX_VALUES = 8;

function unique(
  values: Iterable<string | null | undefined>,
  limit = MAX_VALUES,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = raw?.trim();
    if (!value) continue;
    const key = value.toLocaleLowerCase("uk");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

function intersection(a: string[], b: string[]): string[] {
  const keys = new Set(a.map((value) => value.toLocaleLowerCase("uk")));
  return b.filter((value) =>
    keys.has(value.toLocaleLowerCase("uk")),
  );
}

/** Ключ цены: числа сравниваем как числа, остальное — как текст. */
function priceKey(value: string): string {
  const number = parsePriceNumber(value);
  return number !== null
    ? `number:${number}`
    : `text:${value.trim().toLocaleLowerCase("uk")}`;
}

function intersectPrices(a: string[], b: string[]): string[] {
  const keys = new Set(a.map(priceKey));
  return unique(
    b.filter((value) => keys.has(priceKey(value))),
    Number.POSITIVE_INFINITY,
  );
}

function samePriceKeys(a: string[], b: string[]): boolean {
  const aKeys = new Set(a.map(priceKey));
  const bKeys = new Set(b.map(priceKey));
  if (aKeys.size !== bKeys.size) return false;
  for (const key of aKeys) {
    if (!bKeys.has(key)) return false;
  }
  return true;
}

/**
 * Один товар на кожен колір групи.
 *
 * В групі може бути багато розмірів одного кольору — для порівняння
 * достатньо однієї картки. Без кольору групуємо за назвою.
 */
export function uniqueColorProducts(
  products: ComparisonProduct[],
): ComparisonProduct[] {
  const groups = new Map<string, ComparisonProduct[]>();

  for (const product of products) {
    const color = product.color?.trim().toLocaleLowerCase("uk");
    const key = color
      ? `color:${color}`
      : `title:${product.title.trim().toLocaleLowerCase("uk")}`;
    const group = groups.get(key);
    if (group) group.push(product);
    else groups.set(key, [product]);
  }

  return [...groups.values()].map(
    (group) =>
      group.find((product) => product.images.length > 0 && product.price) ??
      group.find((product) => product.images.length > 0) ??
      group[0],
  );
}

function sideFor(
  group: Group,
  products: Map<number, Product>,
): ComparisonSide {
  const values = group.productIds
    .map((id) => products.get(id))
    .filter((product): product is Product => product !== undefined);

  const sortedProducts = sortGroupProducts(values);
  const articles = unique(values.map((product) => product.goodsArticle));
  const articleKeys = new Set(
    articles.map((value) => value.toLocaleLowerCase("uk")),
  );
  const articleBases = unique(
    values.map((product) => articleBase(product.goodsArticle)),
  ).filter(
    (value) => !articleKeys.has(value.toLocaleLowerCase("uk")),
  );

  return {
    id: group.id,
    number: group.number,
    title: group.title,
    count: group.productIds.length,
    brands: unique(values.map((product) => product.producersTitle)),
    sellers: unique(values.map((product) => product.sellerTitle)),
    articles,
    articleBases,
    mdgs: unique(values.map((product) => product.mdg)),
    sizes: unique(values.map((product) => product.size)),
    colors: unique(values.map((product) => product.color)),
    prices: unique(
      values.map((product) => product.goodsPrice),
      Number.POSITIVE_INFINITY,
    ),
    products: sortedProducts.map((product) => ({
      id: product.id,
      title: product.goodsTitle,
      price: product.goodsPrice?.trim() || null,
      size: product.size,
      color: product.color,
      images: product.imageUrls.filter(Boolean),
    })),
  };
}

/** Собирает данные для сравнения двух групп без обращения к Jev. */
export function buildGroupComparison(
  a: Group,
  b: Group,
  products: Map<number, Product>,
): GroupComparison {
  const sideA = sideFor(a, products);
  const sideB = sideFor(b, products);
  const articleBases = intersection(sideA.articleBases, sideB.articleBases);
  const prices = intersectPrices(sideA.prices, sideB.prices);

  return {
    a: sideA,
    b: sideB,
    common: {
      brands: intersection(sideA.brands, sideB.brands),
      sellers: intersection(sideA.sellers, sideB.sellers),
      articleBases,
      mdgs: intersection(sideA.mdgs, sideB.mdgs),
      category: a.categoryTitle,
      prices,
    },
    differences: {
      titles: a.title !== b.title,
      articles:
        sideA.articles.length > 0 &&
        sideB.articles.length > 0 &&
        intersection(sideA.articles, sideB.articles).length === 0,
      colors:
        sideA.colors.length > 0 &&
        sideB.colors.length > 0 &&
        intersection(sideA.colors, sideB.colors).length === 0,
      sizes:
        sideA.sizes.length > 0 &&
        sideB.sizes.length > 0 &&
        intersection(sideA.sizes, sideB.sizes).length === 0,
      prices:
        sideA.prices.length > 0 &&
        sideB.prices.length > 0 &&
        !samePriceKeys(sideA.prices, sideB.prices),
    },
  };
}

/** Есть ли у групп хоть один общий смысловой признак. */
export function hasCommonEvidence(comparison: GroupComparison): boolean {
  const { common } = comparison;
  return (
    common.brands.length > 0 ||
    common.articleBases.length > 0 ||
    common.mdgs.length > 0
  );
}
