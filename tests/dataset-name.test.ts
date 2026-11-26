import assert from "node:assert/strict";
import { test } from "node:test";

import {
  datasetNameFromProducts,
  formatDatasetDate,
} from "@/lib/dataset-name";
import { stripTableFileExtension } from "@/lib/file-name";

const timestamp = new Date(2026, 10, 26, 12, 0, 0).getTime();

test("название файла: продавец, количество товаров и дата", () => {
  assert.equal(
    datasetNameFromProducts(
      [{ sellerTitle: "KHAN" }, { sellerTitle: "KHAN" }],
      timestamp,
    ),
    "KHAN_2_26.11.2026",
  );
});

test("при разных seller_title используется all", () => {
  assert.equal(
    datasetNameFromProducts(
      [{ sellerTitle: "KHAN" }, { sellerTitle: "Metryvia" }],
      timestamp,
    ),
    "all_2_26.11.2026",
  );
});

test("пустой seller_title также даёт all", () => {
  assert.equal(
    datasetNameFromProducts([{ sellerTitle: "" }], timestamp),
    "all_1_26.11.2026",
  );
});

test("дата дополняется нулями", () => {
  assert.equal(
    formatDatasetDate(new Date(2026, 0, 5).getTime()),
    "05.01.2026",
  );
});

test("расширение табличного файла убирается только у csv/xlsx/xls", () => {
  assert.equal(stripTableFileExtension("KHAN_2_26.11.2026.csv"), "KHAN_2_26.11.2026");
  assert.equal(stripTableFileExtension("KHAN_2_26.11.2026"), "KHAN_2_26.11.2026");
});
