import Papa from "papaparse";

import { buildColumnMapping, readValue, parseImageUrls } from "@/lib/csv/columns";
import { unescapeTitle } from "@/lib/grouping/title-text";
import type { ColumnField, ColumnMapping, ParsedProduct } from "@/lib/types";

/** Результат разбора файла. */
export interface ParseResult {
  products: ParsedProduct[];
  header: string[];
  columnMap: ColumnMapping[];
  /** Строки, которые не удалось разобрать (нет goods_id / разная длина строки). */
  skippedRows: number;
}

/**
 * Разбирает CSV-файл в товары.
 *
 * Обязательно только `goods_id`: остальные поля могут отсутствовать или быть
 * пустыми. Колонки-атрибуты имеют вид `Название;ID`; одно базовое имя может
 * соответствовать нескольким колонкам (например `Цвет;131559` и `Цвет;38580`).
 * Значение берётся из первой непустой подходящей колонки.
 */
export function parseCsv(text: string): ParseResult {
  // BOM в начале файла ломает сравнение имён колонок — убираем его.
  const normalized = text.replace(/^\uFEFF/, "");

  const result = Papa.parse<string[]>(normalized, {
    skipEmptyLines: "greedy",
  });

  const header = (result.data[0] ?? []).map((h) => String(h).trim());
  const rows = result.data.slice(1);
  const columnMap = buildColumnMapping(header);

  const byField = new Map<ColumnField, ColumnMapping>();
  for (const m of columnMap) byField.set(m.field, m);

  const products: ParsedProduct[] = [];
  let skippedRows = 0;

  for (const row of rows) {
    if (!row || row.length === 0) continue;

    // Строка с другим числом колонок — пропускаем, но считаем.
    if (row.length !== header.length) {
      skippedRows++;
      continue;
    }

    const value = (field: ColumnField): string | null => {
      const m = byField.get(field);
      if (!m) return null;
      return readValue(row, m.columns, m.primary, header);
    };

    const goodsId = value("goodsId");
    if (!goodsId) {
      skippedRows++;
      continue;
    }

    const goodsArticle = value("goodsArticle") ?? "";
    const goodsTitle = unescapeTitle(
      value("goodsTitle") ?? (goodsArticle || goodsId),
    );

    products.push({
      order: products.length,
      goodsId,
      goodsTitle,
      goodsArticle,
      goodsPrice: value("goodsPrice") ?? "",
      producersTitle: value("producersTitle") ?? "",
      categoryId: value("categoryId") ?? "",
      categoryTitle: value("categoryTitle") ?? "",
      sellerTitle: value("sellerTitle") ?? "",
      gomerSyncSourceId: value("gomerSyncSourceId") ?? "",
      mdg: value("mdg"),
      description: value("description"),
      size: value("size"),
      color: value("color"),
      height: value("height"),
      ean: value("ean"),
      imageUrls: parseImageUrls(value("imageUrls")),
    });
  }

  return { products, header, columnMap, skippedRows };
}
