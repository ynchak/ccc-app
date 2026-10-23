import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_CARD_WIDTH,
  cardGridStyle,
  normalizeCardWidth,
} from "@/lib/card-size";

test("старые размеры карточек переводятся в пиксели", () => {
  assert.equal(normalizeCardWidth("small"), 180);
  assert.equal(normalizeCardWidth("medium"), DEFAULT_CARD_WIDTH);
  assert.equal(normalizeCardWidth("large"), 340);
});

test("ширина карточки округляется до шага 10 и ограничивается", () => {
  assert.equal(normalizeCardWidth(341), 340);
  assert.equal(normalizeCardWidth(344), 340);
  assert.equal(normalizeCardWidth(345), 350);
  assert.equal(normalizeCardWidth(100), 140);
  assert.equal(normalizeCardWidth(999), 400);
  assert.equal(normalizeCardWidth("bad"), DEFAULT_CARD_WIDTH);
});

test("сетка использует выбранную ширину", () => {
  assert.deepEqual(cardGridStyle(250), {
    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 250px), 250px))",
    justifyContent: "center",
  });
});
