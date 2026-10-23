/**
 * Нумерация групп.
 *
 * Номер группы нужен для быстрой идентификации: названия бывают похожими.
 * Номера постоянные: при переименовании, переносе товаров и объединении
 * групп они не пересчитываются. Новые группы получают следующий свободный
 * номер, а номера удалённых групп не переиспользуются.
 */

interface NumberedGroup {
  id: number;
  number?: number;
  categoryTitle: string;
  title: string;
}

/** Результат нормализации номеров. */
export interface NormalizeNumbersResult<T> {
  groups: T[];
  /** Группы, которым номер был назначен или исправлен. */
  changed: T[];
}

/**
 * Назначает номера группам без номера (например, данным из старой версии)
 * и исправляет дубли. Существующие уникальные номера сохраняются.
 */
export function normalizeGroupNumbers<T extends NumberedGroup>(
  groups: T[],
): NormalizeNumbersResult<T> {
  const used = new Set<number>();
  const missing: T[] = [];

  for (const group of groups) {
    const number = group.number;
    if (
      typeof number === "number" &&
      Number.isInteger(number) &&
      number > 0 &&
      !used.has(number)
    ) {
      used.add(number);
    } else {
      missing.push(group);
    }
  }

  if (missing.length === 0) {
    return { groups, changed: [] };
  }

  let nextNumber = Math.max(0, ...used) + 1;
  missing.sort(
    (a, b) =>
      (a.categoryTitle || "").localeCompare(b.categoryTitle || "", "uk") ||
      (a.title || "").localeCompare(b.title || "", "uk"),
  );

  const assigned = new Map<number, number>();
  for (const group of missing) {
    assigned.set(group.id, nextNumber);
    nextNumber++;
  }

  const changed: T[] = [];
  const normalized = groups.map((group) => {
    const number = assigned.get(group.id);
    if (number === undefined) return group;
    const next = { ...group, number };
    changed.push(next);
    return next;
  });

  return { groups: normalized, changed };
}
