import type { JevPair, JevPairResult } from "@/lib/jev/types";

export const JEV_PROMPT_VERSION = "jev-same-model-v3";
export const DEFAULT_JEV_MODEL = "typesafe/jev-1.14";

interface JevQuestion {
  type: "noul";
  instructions: string;
  criteria: { true: string; false: string };
}

export interface JevRequestBody {
  model: string;
  state: unknown;
  questions: Record<string, JevQuestion>;
}

function compactProfile(profile: JevPair["a"]) {
  const result: Record<string, unknown> = { title: profile.title };
  if (profile.brand) result.brand = profile.brand;
  const code = profile.articleBase || profile.article;
  if (code) result.code = code;
  if (profile.mdg) result.mdg = profile.mdg;
  if (profile.examples?.length) result.examples = profile.examples;
  return result;
}

function compactPair(pair: JevPair) {
  return {
    a: compactProfile(pair.a),
    b: compactProfile(pair.b),
  };
}

/**
 * Собирает запрос к Jev для System One API.
 *
 * Jev не генерирует текст: мы спрашиваем две вероятности на каждую пару.
 * Инструкции на английском, потому что английский — основной язык Jev.
 */
export function buildJevRequestBody(
  pairs: JevPair[],
  model: string,
): JevRequestBody {
  const questions: Record<string, JevQuestion> = {};

  pairs.forEach((_, index) => {
    const path = `pairs[${index}]`;
    questions[`pair_${index}_type`] = {
      type: "noul",
      instructions: `Do \`${path}.a\` and \`${path}.b\` describe the same product type? Ignore color, size, and height.`,
      criteria: {
        true: "Both profiles describe the same kind of product, such as two coats or two dresses.",
        false: "The profiles describe different kinds of products.",
      },
    };
    questions[`pair_${index}_model`] = {
      type: "noul",
      instructions: `Do \`${path}.a\` and \`${path}.b\` represent variants of the same manufacturer model, differing only in color, size, height, or listing wording? A shared model code or a shared \`articleBase\` before the variant suffix is strong evidence. A different \`mdg\` or full \`article\` alone is not evidence against the same model, because those identifiers may be variant-specific.`,
      criteria: {
        true: "The profiles are the same product model; color, size, height, or wording may differ.",
        false: "The profiles are different product models, or the evidence is insufficient.",
      },
    };
  });

  return {
    model,
    state: { pairs: pairs.map(compactPair) },
    questions,
  };
}

function readNoul(
  answers: Record<string, unknown>,
  key: string,
): number | null {
  const answer = answers[key];
  if (!answer || typeof answer !== "object") return null;
  const record = answer as { type?: unknown; noul?: unknown };
  if (record.type !== "noul" || typeof record.noul !== "number") return null;
  if (!Number.isFinite(record.noul) || record.noul < 0 || record.noul > 1) {
    return null;
  }
  return record.noul;
}

/** Разбирает ответ Jev и сопоставляет вероятности с исходными парами. */
export function parseJevAnswers(
  pairs: JevPair[],
  payload: unknown,
): JevPairResult[] {
  if (!payload || typeof payload !== "object") return [];
  const answers = (payload as { answers?: unknown }).answers;
  if (!answers || typeof answers !== "object") return [];

  const result: JevPairResult[] = [];
  pairs.forEach((pair, index) => {
    const sameType = readNoul(
      answers as Record<string, unknown>,
      `pair_${index}_type`,
    );
    const sameModel = readNoul(
      answers as Record<string, unknown>,
      `pair_${index}_model`,
    );
    if (sameType === null || sameModel === null) return;
    result.push({
      aId: pair.a.id,
      bId: pair.b.id,
      sameType,
      sameModel,
    });
  });
  return result;
}
