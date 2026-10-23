import type { Product } from "@/lib/types";

/**
 * Источник названий групп.
 *
 * Сейчас используется исходный заголовок первого товара. Позже эту задачу
 * заберёт LLM — она добавится второй реализацией интерфейса, не затрагивая
 * остальной код.
 */
export interface GroupTitleProvider {
  /** Возвращает название группы и исходный заголовок первого товара. */
  derive(products: Product[]): { title: string; titleRaw: string };
}

/** Название из первого товара группы, без очистки. */
export class DerivedTitleProvider implements GroupTitleProvider {
  derive(products: Product[]): { title: string; titleRaw: string } {
    const first = products[0];
    if (!first) return { title: "", titleRaw: "" };
    const title = first.goodsTitle || first.goodsArticle || first.goodsId;
    return { title, titleRaw: first.goodsTitle };
  }
}

/** Провайдер по умолчанию. */
export const titleProvider: GroupTitleProvider = new DerivedTitleProvider();
