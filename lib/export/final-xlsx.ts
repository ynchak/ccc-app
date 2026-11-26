"use client";

import writeXlsxFile from "write-excel-file/browser";

import { stripTableFileExtension } from "@/lib/file-name";
import {
  buildFinalExportRows,
  type FinalExportRow,
} from "@/lib/export/final-rows";
import type { Group, Product } from "@/lib/types";

/** Рамка ячейки. */
const border = {
  borderStyle: "thin" as const,
  borderColor: "#DDDDDD",
};

/**
 * Финальный файл потока категорий: id, категория и название группы.
 */
export async function exportFinalXlsx(
  products: Product[],
  groups: Group[],
  productToGroup: Map<number, number>,
  fileName: string,
): Promise<void> {
  const rows = buildFinalExportRows(products, groups, productToGroup);

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
        cell: (row: FinalExportRow) => ({ value: row.id, ...border }),
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
        cell: (row: FinalExportRow) => ({
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
        cell: (row: FinalExportRow) => ({ value: row.categoryId, ...border }),
      },
      {
        header: {
          value: "group_title",
          fontWeight: "bold",
          backgroundColor: "#F4F4F5",
          align: "center",
          ...border,
        },
        width: 64,
        cell: (row: FinalExportRow) => ({ value: row.groupTitle, ...border }),
      },
    ],
  }).toFile(`${stripTableFileExtension(fileName)}.xlsx`);
}
