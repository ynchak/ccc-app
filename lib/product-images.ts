/**
 * Работа с URL фотографий товаров.
 *
 * В CSV приходят ссылки на оригиналы Rozetka (обычно 960×1280 и тяжелее).
 * Для карточек в списке такие фото качать и декодировать слишком дорого,
 * поэтому подставляем уменьшенный вариант того же файла с того же CDN.
 */

/** Путь полноразмерного фото в CDN Rozetka. */
const ORIGINAL_PATH = "/goods/images/original/";

/** Путь уменьшенного варианта: ~473 px по ширине, WebP. */
const CARD_PATH = "/goods/images/big/";

/**
 * URL фото для карточки товара.
 *
 * `/big/` отдаётся как WebP (~30–110 KB вместо 200–400 KB) и содержит
 * достаточно пикселей для карточки шириной до ~400 px на Retina.
 * Ссылки других CDN и локальные URL возвращаются без изменений.
 */
export function cardImageUrl(url: string): string {
  return url.includes(ORIGINAL_PATH)
    ? url.replace(ORIGINAL_PATH, CARD_PATH)
    : url;
}
