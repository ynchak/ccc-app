import type { Group, Product } from "@/lib/types";
import type { JevPairResult, MergeSuggestion } from "@/lib/jev/types";

/** Порог автоматического объединения. */
export const AUTO_MODEL_THRESHOLD = 0.95;
/** Минимальная вероятность одинакового типа товара для авто-объединения. */
export const AUTO_TYPE_THRESHOLD = 0.8;
/** Нижняя граница, начиная с которой показываем предложение. */
export const SUGGEST_MODEL_THRESHOLD = 0.8;

function pairKey(aId: number, bId: number): string {
  return aId < bId ? `${aId}:${bId}` : `${bId}:${aId}`;
}

function sortProductIds(
  ids: number[],
  products: Map<number, Product>,
): number[] {
  return [...new Set(ids)].sort(
    (a, b) => (products.get(a)?.order ?? 0) - (products.get(b)?.order ?? 0),
  );
}

/**
 * Применяет решения Jev к группам.
 *
 * Автоматически сливаются только пары с высокой вероятностью одной модели
 * и одного типа товара. Остальные пары возвращаются как предложения.
 * Ручные группы не трогаем.
 */
export function applyJevDecisions(
  groups: Map<number, Group>,
  decisions: JevPairResult[],
  products: Map<number, Product>,
): {
  groups: Map<number, Group>;
  merged: number;
  suggestions: MergeSuggestion[];
} {
  const next = new Map(groups);
  const parent = new Map<number, number>();

  const find = (id: number): number => {
    const current = parent.get(id);
    if (current === undefined || current === id) {
      parent.set(id, id);
      return id;
    }
    const root = find(current);
    parent.set(id, root);
    return root;
  };

  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };

  const valid: Array<{
    a: Group;
    b: Group;
    result: JevPairResult;
    auto: boolean;
  }> = [];

  for (const result of decisions) {
    const aId = Number(result.aId);
    const bId = Number(result.bId);
    const a = next.get(aId);
    const b = next.get(bId);
    if (!a || !b || a.id === b.id) continue;
    if (a.manual || b.manual) continue;
    if (a.categoryId !== b.categoryId) continue;

    const auto =
      result.sameModel >= AUTO_MODEL_THRESHOLD &&
      result.sameType >= AUTO_TYPE_THRESHOLD;

    valid.push({ a, b, result, auto });
  }

  for (const edge of valid.filter((item) => item.auto)) {
    union(edge.a.id, edge.b.id);
  }

  const components = new Map<number, Group[]>();
  for (const edge of valid) {
    if (!edge.auto) continue;
    for (const group of [edge.a, edge.b]) {
      const root = find(group.id);
      const list = components.get(root);
      if (list) {
        if (!list.some((item) => item.id === group.id)) list.push(group);
      } else {
        components.set(root, [group]);
      }
    }
  }

  let merged = 0;
  for (const component of components.values()) {
    if (component.length < 2) continue;
    component.sort((a, b) => a.number - b.number);
    const target = component[0];
    const productIds = sortProductIds(
      component.flatMap((group) => group.productIds),
      products,
    );
    next.set(target.id, { ...target, productIds });
    for (const source of component.slice(1)) {
      next.delete(source.id);
      merged++;
    }
  }

  const suggestions: MergeSuggestion[] = [];
  const suggestionKeys = new Set<string>();
  for (const edge of valid) {
    const a = next.get(edge.a.id);
    const b = next.get(edge.b.id);
    if (!a || !b) continue;
    if (edge.auto) continue;
    if (edge.result.sameModel < SUGGEST_MODEL_THRESHOLD) continue;

    const key = pairKey(a.id, b.id);
    if (suggestionKeys.has(key)) continue;
    suggestionKeys.add(key);
    suggestions.push({
      aId: a.id,
      bId: b.id,
      sameType: edge.result.sameType,
      sameModel: edge.result.sameModel,
    });
  }

  suggestions.sort((a, b) => b.sameModel - a.sameModel);

  return { groups: next, merged, suggestions };
}
