import type { CategoryRef } from "@/lib/types";

/**
 * Мультиязычный поиск по категории: запрос сверяется с id и всеми
 * вариантами названия — так «Жіночі костюми» находится по вводу
 * «Женские костюмы» и наоборот.
 */
export function matchesCategoryQuery(
  category: CategoryRef,
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  if (category.id.toLowerCase().includes(normalized)) return true;
  if (category.title.toLowerCase().includes(normalized)) return true;
  if (category.titleRu?.toLowerCase().includes(normalized)) return true;
  if (category.titleUk?.toLowerCase().includes(normalized)) return true;
  return false;
}

/** Порядок категорий в списках — по отображаемому названию. */
export function compareCategories(a: CategoryRef, b: CategoryRef): number {
  return a.title.localeCompare(b.title, "uk");
}
