import type { ClusteredGroup } from "@/lib/grouping/cluster";
import type { ParsedProduct } from "@/lib/types";

export type PreviewIssueReason = "no-photo" | "invalid-url" | "singleton";

export interface PreviewIssue {
  goodsId: string;
  title: string;
  reason: PreviewIssueReason;
  imageCount: number;
}

export interface ImportPreviewSummary {
  totalProducts: number;
  totalGroups: number;
  productsWithoutPhotos: number;
  productsWithInvalidUrls: number;
  invalidPhotoUrls: number;
  groupsWithoutPhotos: number;
  singletonGroups: number;
  noPhotoPercent: number;
  issues: PreviewIssue[];
}

function isValidPhotoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Проверяет ссылки и собирает данные для предпросмотра импорта. */
export function buildImportPreview(
  products: ParsedProduct[],
  groups: ClusteredGroup[],
): ImportPreviewSummary {
  const groupByProduct = new Map<number, number>();
  groups.forEach((group, groupIndex) => {
    for (const productIndex of group.memberIndexes) {
      groupByProduct.set(productIndex, groupIndex);
    }
  });

  let productsWithoutPhotos = 0;
  let productsWithInvalidUrls = 0;
  let invalidPhotoUrls = 0;
  let groupsWithoutPhotos = 0;

  groups.forEach((group) => {
    const hasPhoto = group.memberIndexes.some(
      (index) => products[index]?.imageUrls.length > 0,
    );
    if (!hasPhoto) groupsWithoutPhotos++;
  });

  const issues: PreviewIssue[] = [];
  products.forEach((product, index) => {
    const invalidCount = product.imageUrls.filter(
      (url) => !isValidPhotoUrl(url),
    ).length;
    const hasInvalid = invalidCount > 0;
    const hasNoPhoto = product.imageUrls.length === 0;
    if (hasNoPhoto) productsWithoutPhotos++;
    if (hasInvalid) {
      productsWithInvalidUrls++;
      invalidPhotoUrls += invalidCount;
    }

    const groupIndex = groupByProduct.get(index);
    const group = groupIndex !== undefined ? groups[groupIndex] : undefined;
    const reason: PreviewIssueReason | null = hasNoPhoto
      ? "no-photo"
      : hasInvalid
        ? "invalid-url"
        : group && group.memberIndexes.length === 1
          ? "singleton"
          : null;

    if (reason && issues.length < 10) {
      issues.push({
        goodsId: product.goodsId,
        title: product.goodsTitle,
        reason,
        imageCount: product.imageUrls.length,
      });
    }
  });

  const noPhotoPercent =
    products.length > 0
      ? (productsWithoutPhotos / products.length) * 100
      : 0;

  return {
    totalProducts: products.length,
    totalGroups: groups.length,
    productsWithoutPhotos,
    productsWithInvalidUrls,
    invalidPhotoUrls,
    groupsWithoutPhotos,
    singletonGroups: groups.filter(
      (group) => group.memberIndexes.length === 1,
    ).length,
    noPhotoPercent,
    issues,
  };
}
