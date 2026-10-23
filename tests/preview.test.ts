import assert from "node:assert/strict";
import { test } from "node:test";

import { buildImportPreview } from "@/lib/csv/preview";
import type { ClusteredGroup } from "@/lib/grouping/cluster";
import type { ParsedProduct } from "@/lib/types";

function product(
  order: number,
  imageUrls: string[],
  title = `Товар ${order}`,
): ParsedProduct {
  return {
    order,
    goodsId: String(order),
    goodsTitle: title,
    goodsArticle: "",
    producersTitle: "",
    categoryId: "cat",
    categoryTitle: "Категорія",
    sellerTitle: "",
    gomerSyncSourceId: "",
    mdg: null,
    description: null,
    size: null,
    color: null,
    height: null,
    ean: null,
    imageUrls,
  };
}

function group(memberIndexes: number[]): ClusteredGroup {
  return {
    memberIndexes,
    title: "Група",
    titleRaw: "Група",
    titleKey: "група",
    categoryId: "cat",
    categoryTitle: "Категорія",
  };
}

test("preview рахує товари без фото, биті посилання та одиночні групи", () => {
  const products = [
    product(0, ["https://img/1.jpg"]),
    product(1, ["https://img/1.jpg"]),
    product(2, []),
    product(3, ["not-a-url"]),
    product(4, ["https://img/5.jpg"]),
  ];
  const groups = [group([0, 1]), group([2]), group([3]), group([4])];
  const preview = buildImportPreview(products, groups);

  assert.equal(preview.totalProducts, 5);
  assert.equal(preview.totalGroups, 4);
  assert.equal(preview.productsWithoutPhotos, 2);
  assert.equal(preview.productsWithInvalidUrls, 1);
  assert.equal(preview.invalidPhotoUrls, 1);
  assert.equal(preview.groupsWithoutPhotos, 2);
  assert.equal(preview.singletonGroups, 3);
  assert.equal(preview.noPhotoPercent, 40);
  assert.deepEqual(
    preview.issues.map((issue) => issue.reason),
    ["no-photo", "invalid-url", "singleton"],
  );
});

test("preview не падает на пустом файле", () => {
  const preview = buildImportPreview([], []);
  assert.equal(preview.totalProducts, 0);
  assert.equal(preview.totalGroups, 0);
  assert.equal(preview.noPhotoPercent, 0);
});
