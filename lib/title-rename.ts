/**
 * Ручное переименование товаров группы по индексам слов.
 *
 * Сравнивает старое и новое название группы слово в слово по индексам.
 * Найденные различия применяются к названиям всех товаров кластера
 * (поля goodsTitle и goodsTitleUk). Совпадение слова у товара –
 * без учёта регистра.
 */

import type { Product } from "@/lib/types";

export interface WordReplacement {
  index: number;
  from: string;
  to: string;
}

/** Вычисляет различия между старым и новым названием группы по индексам слов. */
export function computeWordReplacements(
  oldTitle: string,
  newTitle: string,
): WordReplacement[] {
  const oldWords = oldTitle.trim().split(/\s+/).filter(Boolean);
  const newWords = newTitle.trim().split(/\s+/).filter(Boolean);
  const replacements: WordReplacement[] = [];
  const maxLen = Math.max(oldWords.length, newWords.length);

  for (let i = 0; i < maxLen; i++) {
    const oldWord = oldWords[i];
    const newWord = newWords[i];

    if (oldWord === undefined) {
      // Слово добавилось — определить позицию вставке в titre товара по индексу невозможно.
      continue;
    }
    if (newWord === undefined) {
      replacements.push({ index: i, from: oldWord, to: "" });
    } else if (oldWord.toLowerCase() !== newWord.toLowerCase()) {
      replacements.push({ index: i, from: oldWord, to: newWord });
    }
  }

  return replacements;
}

/** Применяет замены к одному названию товара. Замены применяются от старшего индекса к младшему, чтобы не сбивать позиции при удалении. */
export function applyReplacementsToTitle(
  title: string | undefined,
  replacements: WordReplacement[],
): string {
  if (!title) return "";
  const words = title.trim().split(/\s+/).filter(Boolean);
  const sorted = [...replacements].sort((a, b) => b.index - a.index);

  for (const { index, from, to } of sorted) {
    if (index >= 0 && index < words.length) {
      if (words[index].toLowerCase() === from.toLowerCase()) {
        if (to === "") {
          words.splice(index, 1);
        } else {
          words[index] = to;
        }
      }
    }
  }

  return words.join(" ");
}

export interface ProductRenamePreview {
  productId: number;
  goodsId: string;
  order: number;
  oldTitle: string;
  newTitle: string;
  oldTitleUk?: string;
  newTitleUk?: string;
  /** Отредактированное пользователем название RU (если не менялось — равно newTitle). */
  editedTitle: string;
  /** Отредактированное пользователем название UA (если не менялось — равно newTitleUk). */
  editedTitleUk?: string;
  changed: boolean;
}

/** Строит превью переименования для всех товаров кластера. */
export function buildRenamePreview(
  products: Product[],
  replacements: WordReplacement[],
): ProductRenamePreview[] {
  return products
    .map((product) => {
      const newTitle = applyReplacementsToTitle(product.goodsTitle, replacements);
      const newTitleUk = applyReplacementsToTitle(product.goodsTitleUk, replacements);
      return {
        productId: product.id,
        goodsId: product.goodsId,
        order: product.order,
        oldTitle: product.goodsTitle,
        newTitle,
        oldTitleUk: product.goodsTitleUk,
        newTitleUk,
        editedTitle: newTitle,
        editedTitleUk: newTitleUk,
        changed: newTitle !== product.goodsTitle || newTitleUk !== product.goodsTitleUk,
      };
    })
    .sort((a, b) => a.order - b.order);
}
