"use client";

import writeXlsxFile from "write-excel-file/browser";

import { stripTableFileExtension } from "@/lib/file-name";
import {
  buildCategoryChangeRows,
  type CategoryExportRow,
} from "@/lib/export/category-rows";
import type { CategoryCluster, Product } from "@/lib/types";

/** Рамка ячейки. */
const border = {
  borderStyle: "thin" as const,
  borderColor: "#DDDDDD",
};

/** Выгружает только товары с изменённой категорией. */
export async function exportCategoryChanges(
  products: Product[],
  clusters: CategoryCluster[],
  fileName: string,
): Promise<number> {
  const rows = buildCategoryChangeRows(products, clusters);
  if (rows.length === 0) return 0;

  await writeXlsxFile(rows, {
    sheet: "Категорії",
    columns: [
      {
        header: {
          value: "id",
          fontWeight: "bold",
          backgroundColor: "#F4F4F5",
          align: "center",
          ...border,
        },
        width: 16,
        cell: (row: CategoryExportRow) => ({ value: row.id, ...border }),
      },
      {
        header: {
          value: "goods_category_title",
          fontWeight: "bold",
          backgroundColor: "#F4F4F5",
          align: "center",
          ...border,
        },
        width: 40,
        cell: (row: CategoryExportRow) => ({
          value: row.categoryTitle,
          ...border,
        }),
      },
      {
        header: {
          value: "goods_category_id",
          fontWeight: "bold",
          backgroundColor: "#F4F4F5",
          align: "center",
          ...border,
        },
        width: 18,
        cell: (row: CategoryExportRow) => ({ value: row.categoryId, ...border }),
      },
    ],
  }).toFile(`${stripTableFileExtension(fileName)}-categories.xlsx`);

  return rows.length;
}
