import type { Group, Product } from "@/lib/types";
import type { CandidatePair, JevGroupProfile } from "@/lib/jev/types";

/**
 * Поиск пар-кандидатов для Jev.
 *
 * Jev не умеет искать, что с чем сравнивать, поэтому пары готовит код.
 * Сравниваем только группы одной категории и одного бренда. Внутри —
 * общие коды моделей, МДГ, артикулы и заметное пересечение названий.
 */

interface IndexedGroup {
  group: Group;
  profile: JevGroupProfile;
  modelKeys: Set<string>;
  titleTokens: Set<string>;
  brandKey: string;
}

const DEFAULT_MAX_PER_GROUP = 12;
const DEFAULT_MAX_PAIRS = 1000;
const ALL_PAIRS_LIMIT = 40;

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokenize(value: string): string[] {
  const normalized = normalize(value);
  return normalized ? normalized.split(" ") : [];
}

function addModelKeys(
  keys: Set<string>,
  value: string | null | undefined,
): void {
  if (!value) return;
  for (const token of tokenize(value)) {
    if (token.length >= 3 && /\d/.test(token)) keys.add(token);
  }
}

/**
 * Выделяет общую часть артикула.
 *
 * В выгрузках артикул часто состоит из кода модели и вариантного суффикса:
 * `4302207-navyblue-XXL` → `4302207`. Если суффиксов нет, возвращаем артикул
 * целиком — тогда он хотя бы может совпасть точно.
 */
export function articleBase(article: string | null | undefined): string | undefined {
  const value = article?.trim();
  if (!value) return undefined;
  const parts = value.split(/[-_/]+/).filter(Boolean);
  if (parts.length <= 1) return value.length >= 4 ? value : undefined;

  let base = parts[0];
  for (let index = 1; index < parts.length; index++) {
    if (/\d/.test(parts[index])) {
      base = `${base}-${parts[index]}`;
      break;
    }
  }
  return base.length >= 4 ? base : undefined;
}

/** Ключи, которые с большой вероятностью являются кодом модели. */
function modelKeysFor(profile: JevGroupProfile): Set<string> {
  const keys = new Set<string>();
  const texts = [profile.title, profile.rawTitle, ...(profile.examples ?? [])];
  for (const text of texts) {
    if (text) addModelKeys(keys, text);
  }

  if (profile.mdg) {
    // МДГ часто выглядит как "15946_бежевый" — берём части отдельно.
    for (const part of profile.mdg.split(/[_\s,;/]+/)) {
      if (part.length >= 3 && /\d/.test(part)) keys.add(normalize(part));
    }
  }

  if (profile.article) {
    const article = normalize(profile.article);
    if (article.length >= 4) keys.add(article);
  }
  if (profile.articleBase) {
    const base = normalize(profile.articleBase);
    if (base.length >= 4) keys.add(base);
  }

  return keys;
}

function titleTokensFor(profile: JevGroupProfile): Set<string> {
  const tokens = new Set<string>();
  const texts = [profile.title, profile.rawTitle, ...(profile.examples ?? [])];
  for (const text of texts) {
    if (!text) continue;
    for (const token of tokenize(text)) {
      if (token.length >= 4) tokens.add(token);
    }
  }
  return tokens;
}

export function buildJevGroupProfile(
  group: Group,
  products: Map<number, Product>,
): JevGroupProfile | null {
  const first = products.get(group.productIds[0]);
  if (!first) return null;

  const examples: string[] = [];
  const seen = new Set<string>();
  let brand = first.producersTitle?.trim() || undefined;
  let mdg = first.mdg?.trim() || undefined;
  let article = first.goodsArticle?.trim() || undefined;
  for (const productId of group.productIds) {
    const product = products.get(productId);
    if (!product) continue;
    brand ||= product.producersTitle?.trim() || undefined;
    mdg ||= product.mdg?.trim() || undefined;
    article ||= product.goodsArticle?.trim() || undefined;
    const title = product.goodsTitle?.trim();
    if (!title || seen.has(title)) continue;
    seen.add(title);
    if (title !== group.title) examples.push(title);
    if (examples.length >= 3) break;
  }

  return {
    id: String(group.id),
    title: group.title.trim() || first.goodsTitle || `Группа ${group.number}`,
    rawTitle: group.titleRaw.trim() || first.goodsTitle || undefined,
    category: group.categoryTitle || undefined,
    brand,
    mdg,
    article,
    articleBase: articleBase(article),
    examples: examples.length > 0 ? examples : undefined,
  };
}

function brandKeyFor(profile: JevGroupProfile): string {
  return normalize(profile.brand ?? "");
}

function candidateScore(a: IndexedGroup, b: IndexedGroup): number {
  let sharedModel = 0;
  for (const key of a.modelKeys) {
    if (b.modelKeys.has(key)) sharedModel++;
  }

  let sharedTitle = 0;
  for (const token of a.titleTokens) {
    if (b.titleTokens.has(token)) sharedTitle++;
  }

  const unionSize =
    a.titleTokens.size + b.titleTokens.size - sharedTitle;
  const jaccard = unionSize > 0 ? sharedTitle / unionSize : 0;

  if (sharedModel === 0 && jaccard < 0.45 && sharedTitle < 2) {
    return 0;
  }

  return sharedModel * 3 + sharedTitle * 0.5 + jaccard * 2;
}

function pairKey(aId: number, bId: number): string {
  return aId < bId ? `${aId}:${bId}` : `${bId}:${aId}`;
}

/**
 * Собирает пары для проверки Jev.
 *
 * Для небольших категорий проверяются все пары, для больших — только пары
 * с общими ключами модели или заметно похожими названиями.
 */
export function generateCandidatePairs(
  groups: Iterable<Group>,
  products: Map<number, Product>,
  options?: { maxPerGroup?: number; maxPairs?: number },
): CandidatePair[] {
  const maxPerGroup = options?.maxPerGroup ?? DEFAULT_MAX_PER_GROUP;
  const maxPairs = options?.maxPairs ?? DEFAULT_MAX_PAIRS;

  const indexed: IndexedGroup[] = [];
  for (const group of groups) {
    if (group.manual || group.productIds.length === 0) continue;
    const profile = buildJevGroupProfile(group, products);
    if (!profile) continue;
    indexed.push({
      group,
      profile,
      modelKeys: modelKeysFor(profile),
      titleTokens: titleTokensFor(profile),
      brandKey: brandKeyFor(profile),
    });
  }

  const buckets = new Map<string, IndexedGroup[]>();
  for (const entry of indexed) {
    const key = entry.group.categoryId;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(entry);
    else buckets.set(key, [entry]);
  }

  const scored = new Map<string, CandidatePair>();

  const addPair = (a: IndexedGroup, b: IndexedGroup) => {
    if (a.group.id === b.group.id) return;
    if (a.group.categoryId !== b.group.categoryId) return;
    if (a.brandKey && b.brandKey && a.brandKey !== b.brandKey) return;
    const score = candidateScore(a, b);
    if (score <= 0) return;
    const key = pairKey(a.group.id, b.group.id);
    const previous = scored.get(key);
    if (!previous || previous.score < score) {
      scored.set(key, {
        aId: Math.min(a.group.id, b.group.id),
        bId: Math.max(a.group.id, b.group.id),
        score,
      });
    }
  };

  for (const bucket of buckets.values()) {
    if (bucket.length <= ALL_PAIRS_LIMIT) {
      for (let i = 0; i < bucket.length; i++) {
        for (let j = i + 1; j < bucket.length; j++) {
          addPair(bucket[i], bucket[j]);
        }
      }
      continue;
    }

    // Большая категория: не перебираем все пары, а идём по индексам.
    const modelIndex = new Map<string, IndexedGroup[]>();
    const titleIndex = new Map<string, IndexedGroup[]>();
    for (const entry of bucket) {
      for (const key of entry.modelKeys) {
        const list = modelIndex.get(key);
        if (list) list.push(entry);
        else modelIndex.set(key, [entry]);
      }
      for (const token of entry.titleTokens) {
        const list = titleIndex.get(token);
        if (list) list.push(entry);
        else titleIndex.set(token, [entry]);
      }
    }

    for (const list of modelIndex.values()) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          addPair(list[i], list[j]);
        }
      }
    }

    for (const list of titleIndex.values()) {
      if (list.length > 80) continue;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          addPair(list[i], list[j]);
        }
      }
    }
  }

  const perGroup = new Map<number, number>();
  const result: CandidatePair[] = [];
  const sorted = [...scored.values()].sort((a, b) => b.score - a.score);
  for (const pair of sorted) {
    if (result.length >= maxPairs) break;
    const aCount = perGroup.get(pair.aId) ?? 0;
    const bCount = perGroup.get(pair.bId) ?? 0;
    if (aCount >= maxPerGroup || bCount >= maxPerGroup) continue;
    perGroup.set(pair.aId, aCount + 1);
    perGroup.set(pair.bId, bCount + 1);
    result.push(pair);
  }

  return result;
}
