import type { Product } from "@/lib/types";

/** Ссылка на товар в Gomer. */
export function gomerProductUrl(
  product: Pick<Product, "goodsId" | "gomerSyncSourceId">,
): string | null {
  const sourceId = product.gomerSyncSourceId.trim();
  const goodsId = product.goodsId.trim();
  if (!sourceId || !goodsId) return null;
  return `https://gomer.rozetka.company/gomer/items/source/${encodeURIComponent(
    sourceId,
  )}?ItemSearch%5Bid%5D=${encodeURIComponent(goodsId)}`;
}

/** Ссылка на товар на Rozetka. */
export function rozetkaProductUrl(goodsId: string): string | null {
  const id = goodsId.trim();
  if (!id) return null;
  return `https://rozetka.com.ua/ua/${encodeURIComponent(id)}/p${encodeURIComponent(id)}/`;
}
