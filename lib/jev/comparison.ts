import type { Group, Product } from "@/lib/types";
import { articleBase } from "@/lib/jev/candidates";

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
  images: string[];
  sampleTitles: string[];
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
  };
  differences: {
    titles: boolean;
    articles: boolean;
    colors: boolean;
    sizes: boolean;
  };
}

const MAX_VALUES = 8;
const MAX_SAMPLES = 3;
const MAX_IMAGES = 3;

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

function sideFor(
  group: Group,
  products: Map<number, Product>,
): ComparisonSide {
  const values = group.productIds
    .map((id) => products.get(id))
    .filter((product): product is Product => product !== undefined);

  const samples = unique(
    values.map((product) => product.goodsTitle),
    MAX_SAMPLES,
  );
  const images: string[] = [];
  const seenImages = new Set<string>();
  for (const product of values) {
    for (const image of product.imageUrls) {
      const url = image.trim();
      if (!url || seenImages.has(url)) continue;
      seenImages.add(url);
      images.push(url);
      if (images.length >= MAX_IMAGES) break;
    }
    if (images.length >= MAX_IMAGES) break;
  }

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
    images,
    sampleTitles: samples,
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

  return {
    a: sideA,
    b: sideB,
    common: {
      brands: intersection(sideA.brands, sideB.brands),
      sellers: intersection(sideA.sellers, sideB.sellers),
      articleBases,
      mdgs: intersection(sideA.mdgs, sideB.mdgs),
      category: a.categoryTitle,
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
