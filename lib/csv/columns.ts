import type { ColumnField, ColumnMapping } from "@/lib/types";

/**
 * Разрешение колонок CSV.
 *
 * Колонки-атрибуты в файле именуются как `Название;ID`, где ID — идентификатор
 * атрибута в источнике. Одно и то же базовое имя встречается с разными ID
 * (например `Цвет;131559` для одежды и `Цвет;38580` для обуви), поэтому
 * сопоставление идёт по базовому имени, а не по полной строке заголовка.
 */

/** Базовая часть имени колонки — то, что до `;`. */
export function baseName(header: string): string {
  const idx = header.indexOf(";");
  return (idx === -1 ? header : header.slice(0, idx)).trim();
}

/** ID атрибута из имени колонки, если он есть. */
export function attributeId(header: string): string | null {
  const idx = header.indexOf(";");
  if (idx === -1) return null;
  const id = header.slice(idx + 1).trim();
  return id.length > 0 ? id : null;
}

/** Описание поля приложения: как искать его в файле. */
interface FieldSpec {
  field: ColumnField;
  label: string;
  /** Базовое имя в файле. */
  base: string;
  /** Известные ID атрибута — проверяются первыми, но не обязательны. */
  preferredIds?: string[];
  /** Поле не влияет на группировку (справочное). */
  informational?: boolean;
  /** Поле обязательно: без него товар не имеет смысла. */
  required?: boolean;
}

/**
 * Порядок важен: описание и MDG содержат ID, но ID может отличаться в других
 * файлах — поэтому всегда есть fallback «любая колонка с таким базовым именем».
 */
const FIELD_SPECS: FieldSpec[] = [
  { field: "goodsId", label: "goods_id", base: "goods_id", required: true },
  { field: "goodsTitle", label: "goods_title", base: "goods_title", required: true },
  { field: "goodsArticle", label: "goods_article", base: "goods_article" },
  { field: "goodsPrice", label: "GOODS_PRICE", base: "goods_price" },
  { field: "producersTitle", label: "producers_title", base: "producers_title" },
  { field: "categoryId", label: "goods_category_id", base: "goods_category_id", required: true },
  { field: "categoryTitle", label: "goods_category_title", base: "goods_category_title", required: true },
  { field: "sellerTitle", label: "seller_title", base: "seller_title" },
  { field: "gomerSyncSourceId", label: "gomer_sync_source_id", base: "gomer_sync_source_id" },
  { field: "imageUrls", label: "goods_images_url", base: "goods_images_url", required: true },
  { field: "mdg", label: "Модель для групування (МДГ)", base: "Модель для группировки (МДГ)", preferredIds: ["215080"], informational: true },
  { field: "description", label: "Опис", base: "Описание", preferredIds: ["1"] },
  { field: "size", label: "Розмір", base: "Размер" },
  { field: "height", label: "Зріст", base: "Рост" },
  { field: "ean", label: "EAN", base: "EAN", preferredIds: ["26294"] },
  { field: "color", label: "Колір", base: "Цвет" },
];

/** Собирает сопоставление полей приложения с колонками файла. */
export function buildColumnMapping(header: string[]): ColumnMapping[] {
  return FIELD_SPECS.map((spec) => {
    // Регистр в заголовках бывает разным: GOODS_PRICE и goods_price.
    const base = spec.base.toLowerCase();
    const matches = header.filter(
      (h) => baseName(h).toLowerCase() === base,
    );

    // Предпочитаем колонку с известным ID, но fallback на любую с тем же именем.
    let primary: string | null = null;
    for (const preferred of spec.preferredIds ?? []) {
      const hit = matches.find((h) => attributeId(h) === preferred);
      if (hit) {
        primary = hit;
        break;
      }
    }
    if (!primary && matches.length > 0) primary = matches[0];

    return {
      field: spec.field,
      label: spec.label,
      columns: matches,
      primary,
      missing: matches.length === 0,
      informational: spec.informational,
    };
  });
}

/**
 * Читает значение поля из строки.
 *
 * Если у поля несколько колонок (один атрибут с разными ID), берётся первое
 * непустое значение. Проверено на тестовом файле: в одной строке никогда не
 * заполнены обе колонки одного атрибута, поэтому такое правило однозначно.
 */
export function readValue(
  row: string[],
  columns: string[],
  primary: string | null,
  header: string[],
): string | null {
  const candidates: string[] = [];
  if (primary) candidates.push(primary);
  for (const col of columns) if (!candidates.includes(col)) candidates.push(col);
  if (candidates.length === 0) return null;

  for (const col of candidates) {
    const idx = header.indexOf(col);
    if (idx === -1) continue;
    const raw = row[idx];
    if (raw === undefined) continue;
    const value = raw.trim();
    if (value.length > 0) return value;
  }
  return null;
}

/**
 * Разбирает поле goods_images_url.
 *
 * В файле это не JSON, а python-лист: `['https://…', 'https://…']`.
 */
export function parseImageUrls(raw: string | null): string[] {
  if (!raw) return [];

  // 1. Пытаемся распарсить как JSON-массив (на случай, если формат изменится).
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed.replace(/'/g, '"'));
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter((v) => v.length > 0);
      }
    } catch {
      // fallthrough к regex-разбору
    }
  }

  // 2. Regex-разбор python-листа.
  const matches = trimmed.match(/https?:\/\/[^\s'"]+/g);
  return matches ? matches.map((v) => v.trim()) : [];
}
