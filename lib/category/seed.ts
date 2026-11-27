import seedCategoriesJson from "@/categorise.json";

import { loadCategories, putCategories } from "@/lib/db/idb";
import type { CategoryEntry } from "@/lib/types";

/** Строка categorise.json. */
interface SeedRecord {
  id: number | string;
  category_title_ru?: string;
  category_title_uk?: string;
}

/** Отображаемое название: сначала украинское, затем русское. */
function displayTitle(record: SeedRecord): string | null {
  const uk = record.category_title_uk?.trim();
  const ru = record.category_title_ru?.trim();
  return uk || ru || null;
}

/**
 * Разбирает json-справочник, отбрасывая записи без id или названия.
 *
 * `category_title_uk` опционален: когда он появится в файле, сид подхватит
 * его при следующей загрузке страницы без какой-либо миграции.
 */
export function parseSeedCategories(raw: unknown): CategoryEntry[] {
  if (!Array.isArray(raw)) return [];

  const byId = new Map<string, CategoryEntry>();
  for (const item of raw as SeedRecord[]) {
    if (!item || typeof item !== "object") continue;
    const id = String(item.id ?? "").trim();
    const title = displayTitle(item);
    if (!id || !title) continue;

    const titleRu = item.category_title_ru?.trim() || undefined;
    const titleUk = item.category_title_uk?.trim() || undefined;
    byId.set(id, { id, title, titleRu, titleUk, source: "seed" });
  }
  return [...byId.values()];
}

/**
 * Заполняет IndexedDB справочником из categorise.json.
 *
 * Слияние, а не перезапись: недостающие id добавляются, у служебных записей
 * обновляются названия из json, пользовательские записи не трогаются и ничего
 * не удаляется — правки переживают обновление файла.
 */
export async function seedCategories(): Promise<{
  added: number;
  updated: number;
}> {
  const seed = parseSeedCategories(seedCategoriesJson);
  if (seed.length === 0) return { added: 0, updated: 0 };

  const existing = new Map(
    (await loadCategories()).map((entry) => [entry.id, entry]),
  );
  const upserts: CategoryEntry[] = [];
  let added = 0;
  let updated = 0;

  for (const entry of seed) {
    const current = existing.get(entry.id);
    if (!current) {
      upserts.push(entry);
      added++;
      continue;
    }
    // Категория, добавленная вручную, принадлежит пользователю.
    if (current.source !== "seed") continue;
    if (
      current.title === entry.title &&
      current.titleRu === entry.titleRu &&
      current.titleUk === entry.titleUk
    ) {
      continue;
    }
    upserts.push({ ...entry, source: "seed" });
    updated++;
  }

  await putCategories(upserts);
  return { added, updated };
}
