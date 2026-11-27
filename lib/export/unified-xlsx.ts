"use client";

import writeXlsxFile from "write-excel-file/browser";

import { stripTableFileExtension } from "@/lib/file-name";
import type { CategoryCluster, Product } from "@/lib/types";
import type { Group } from "@/lib/types";

const border = {
  borderStyle: "thin" as const,
  borderColor: "#DDDDDD",
};

/** Строка файла изменений названия/цвета/группы. */
interface ChangeRow {
  id: string;
  titleWas: string;
  titleNew: string;
  titleUkWas: string;
  titleUkNew: string;
  colorWas: string | null;
  colorNew: string | null;
  groupNew: string;
}

/** Строка файла категорий. */
interface CategoryRow {
  id: string;
  categoryNew: string;
  categoryIdNew: string;
}

/**
 * Единый экспорт для обоих режима (Категории и Группировка).
 *
 * Создаёт два XLSX-файла:
 * 1. `-categories.xlsx` — только товары с изменённой категорией.
 * 2. `-changes.xlsx` — товары с изменённым названием, цветом или группой.
 *
 * Столбцы без `(was)` заполняются только если значение реально изменилось
 * относительно исходного из CSV.
 *
 * На этапе Группировки передаются `groups` и `productToGroup`.
 *
 * Возвращает суммарное количество записанных строк.
 */
export async function exportUnifiedXlsx(
  products: Product[],
  fileName: string,
  options?: {
    clusters?: CategoryCluster[];
    groups?: Group[];
    productToGroup?: Map<number, number>;
  },
): Promise<number> {
  const clusterByProduct = new Map<number, CategoryCluster>();
  if (options?.clusters) {
    for (const cluster of options.clusters) {
      for (const productId of cluster.productIds) {
        clusterByProduct.set(productId, cluster);
      }
    }
  }

  const groupById = new Map<number, Group>();
  if (options?.groups) {
    for (const group of options.groups) {
      groupById.set(group.id, group);
    }
  }

  const changeRows: ChangeRow[] = [];
  const categoryRows: CategoryRow[] = [];

  for (const product of [...products].sort((a, b) => a.order - b.order)) {
    const cluster = clusterByProduct.get(product.id);
    const groupId = options?.productToGroup?.get(product.id);
    const group = groupId !== undefined ? groupById.get(groupId) : undefined;

    const originalId = product.originalCategoryId ?? product.categoryId;
    const currentId = cluster?.targetCategoryId ?? product.categoryId;

    const titleWas = product.originalGoodsTitle ?? product.goodsTitle;
    const titleUkWas =
      product.originalGoodsTitleUk ?? product.goodsTitleUk ?? "";
    const colorWas = product.originalColor ?? null;

    const categoryChanged = originalId !== currentId;
    const titleChanged = product.goodsTitle !== titleWas;
    const titleUkChanged = product.goodsTitleUk !== titleUkWas;
    const colorChanged = product.color !== colorWas;
    const groupChanged = !!group?.title;

    // Файл категорий — только если изменилась категория.
    if (categoryChanged) {
      categoryRows.push({
        id: product.goodsId,
        categoryNew: cluster?.targetCategoryTitle ?? product.categoryTitle ?? "",
        categoryIdNew: currentId,
      });
    }

    // Файл изменений — только если есть хотя бы одно изменение.
    if (titleChanged || titleUkChanged || colorChanged || groupChanged) {
      changeRows.push({
        id: product.goodsId,
        titleWas,
        titleNew: titleChanged ? product.goodsTitle : "",
        titleUkWas,
        titleUkNew: titleUkChanged ? (product.goodsTitleUk ?? "") : "",
        colorWas,
        colorNew: colorChanged ? product.color : null,
        groupNew: group?.title ?? "",
      });
    }
  }

  let count = 0;

  // 1. Файл категорий.
  if (categoryRows.length > 0) {
    await writeXlsxFile(categoryRows, {
      sheet: "Категории",
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
          cell: (row: CategoryRow) => ({ value: row.id, ...border }),
        },
        {
          header: {
            value: "Категория",
            fontWeight: "bold",
            backgroundColor: "#F4F4F5",
            align: "center",
            ...border,
          },
          width: 32,
          cell: (row: CategoryRow) => ({ value: row.categoryNew, ...border }),
        },
        {
          header: {
            value: "Категория ID",
            fontWeight: "bold",
            backgroundColor: "#F4F4F5",
            align: "center",
            ...border,
          },
          width: 18,
          cell: (row: CategoryRow) => ({ value: row.categoryIdNew, ...border }),
        },
      ],
    }).toFile(`${stripTableFileExtension(fileName)}-categories.xlsx`);
    count += categoryRows.length;
  }

  // 2. Файл изменений.
  if (changeRows.length > 0) {
    await writeXlsxFile(changeRows, {
      sheet: "Изменения",
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
          cell: (row: ChangeRow) => ({ value: row.id, ...border }),
        },
        {
          header: {
            value: "Название (was)",
            fontWeight: "bold",
            backgroundColor: "#F4F4F5",
            align: "center",
            ...border,
          },
          width: 42,
          cell: (row: ChangeRow) => ({ value: row.titleWas, ...border }),
        },
        {
          header: {
            value: "Название",
            fontWeight: "bold",
            backgroundColor: "#F4F4F5",
            align: "center",
            ...border,
          },
          width: 42,
          cell: (row: ChangeRow) => ({ value: row.titleNew, ...border }),
        },
        {
          header: {
            value: "Название (UA) (was)",
            fontWeight: "bold",
            backgroundColor: "#F4F4F5",
            align: "center",
            ...border,
          },
          width: 42,
          cell: (row: ChangeRow) => ({ value: row.titleUkWas, ...border }),
        },
        {
          header: {
            value: "Название (UA)",
            fontWeight: "bold",
            backgroundColor: "#F4F4F5",
            align: "center",
            ...border,
          },
          width: 42,
          cell: (row: ChangeRow) => ({ value: row.titleUkNew, ...border }),
        },
        {
          header: {
            value: "Цвет (was)",
            fontWeight: "bold",
            backgroundColor: "#F4F4F5",
            align: "center",
            ...border,
          },
          width: 24,
          cell: (row: ChangeRow) => ({ value: row.colorWas ?? "", ...border }),
        },
        {
          header: {
            value: "Цвет",
            fontWeight: "bold",
            backgroundColor: "#F4F4F5",
            align: "center",
            ...border,
          },
          width: 24,
          cell: (row: ChangeRow) => ({ value: row.colorNew ?? "", ...border }),
        },
        {
          header: {
            value: "Группа",
            fontWeight: "bold",
            backgroundColor: "#F4F4F5",
            align: "center",
            ...border,
          },
          width: 42,
          cell: (row: ChangeRow) => ({ value: row.groupNew, ...border }),
        },
      ],
    }).toFile(`${stripTableFileExtension(fileName)}-changes.xlsx`);
    count += changeRows.length;
  }

  return count;
}
