import assert from "node:assert/strict";
import { test } from "node:test";

import { gomerProductUrl, rozetkaProductUrl } from "@/lib/product-links";

test("ссылка Gomer использует source id и goods_id", () => {
  assert.equal(
    gomerProductUrl({
      goodsId: "631335095",
      gomerSyncSourceId: "source-1",
    }),
    "https://gomer.rozetka.company/gomer/items/source/source-1?ItemSearch%5Bid%5D=631335095",
  );
});

test("ссылки не строятся без обязательных id", () => {
  assert.equal(
    gomerProductUrl({ goodsId: "631335095", gomerSyncSourceId: "" }),
    null,
  );
  assert.equal(rozetkaProductUrl(""), null);
  assert.equal(
    rozetkaProductUrl("631335095"),
    "https://rozetka.com.ua/ua/631335095/p631335095/",
  );
});
