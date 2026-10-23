"use client";

import writeXlsxFile from "write-excel-file/browser";

import { buildExportRows, type ExportRow } from "@/lib/export/rows";
import type { Group, Product } from "@/lib/types";

/** Рамка ячейки. */
const border = {
  borderStyle: "thin" as const,
  borderColor: "#DDDDDD",
};

/**
 * Скачивает XLSX-файл с товарами и их группами.
 */
export async function exportXlsx(
  products: Product[],
  groups: Group[],
  productToGroup: Map<number, number>,
  fileName: string,
): Promise<void> {
  const rows = buildExportRows(products, groups, productToGroup);
  const hasSuggestedColors = rows.some((row) => row.suggestedColor);

  await writeXlsxFile(rows, {
    sheet: "Групи",
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
        cell: (row: ExportRow) => ({ value: row.id, ...border }),
      },
      {
        header: {
          value: "Название",
          fontWeight: "bold",
          backgroundColor: "#F4F4F5",
          align: "center",
          ...border,
        },
        width: 64,
        cell: (row: ExportRow) => ({ value: row.goodsTitle, ...border }),
      },
      {
        header: {
          value: "Категория",
          fontWeight: "bold",
          backgroundColor: "#F4F4F5",
          align: "center",
          ...border,
        },
        width: 28,
        cell: (row: ExportRow) => ({ value: row.categoryTitle, ...border }),
      },
      {
        header: {
          value: "Группа",
          fontWeight: "bold",
          backgroundColor: "#F4F4F5",
          align: "center",
          ...border,
        },
        width: 64,
        cell: (row: ExportRow) => ({ value: row.groupTitle, ...border }),
      },
      ...(hasSuggestedColors
        ? [
            {
              header: {
                value: "Цвет",
                fontWeight: "bold" as const,
                backgroundColor: "#F4F4F5",
                align: "center" as const,
                ...border,
              },
              width: 24,
              cell: (row: ExportRow) => ({
                value: row.suggestedColor,
                ...border,
              }),
            },
          ]
        : []),
    ],
  }).toFile(`${fileName.replace(/\.[^.]+$/, "")}.xlsx`);
}
