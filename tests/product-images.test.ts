import assert from "node:assert/strict";
import { test } from "node:test";

import { cardImageUrl } from "@/lib/product-images";

test("для карточки берётся уменьшенный вариант фото", () => {
  assert.equal(
    cardImageUrl(
      "https://content2.rozetka.com.ua/goods/images/original/676069700.jpg",
    ),
    "https://content2.rozetka.com.ua/goods/images/big/676069700.jpg",
  );
});

test("ссылки других CDN не меняются", () => {
  const url = "https://cdn.example.com/photo.jpg";
  assert.equal(cardImageUrl(url), url);
});

test("уже уменьшенный вариант остаётся прежним", () => {
  const url = "https://content.rozetka.com.ua/goods/images/big/123.jpg";
  assert.equal(cardImageUrl(url), url);
});
