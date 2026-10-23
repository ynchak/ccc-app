/** Типы для второго слоя группировки через Jev. */

export interface JevGroupProfile {
  /** id группы в приложении, передаётся строкой. */
  id: string;
  title: string;
  rawTitle?: string;
  category?: string;
  brand?: string;
  mdg?: string;
  article?: string;
  examples?: string[];
}

export interface JevPair {
  a: JevGroupProfile;
  b: JevGroupProfile;
}

export interface JevPairResult {
  aId: string;
  bId: string;
  /** Вероятность, что это один и тот же тип товара. */
  sameType: number;
  /** Вероятность, что это варианты одной модели. */
  sameModel: number;
}

/** Пара, которую Jev считает возможным объединением, но не уверен на 100%. */
export interface MergeSuggestion {
  aId: number;
  bId: number;
  sameType: number;
  sameModel: number;
}

export interface CandidatePair {
  aId: number;
  bId: number;
  score: number;
}
