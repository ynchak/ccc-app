/**
 * Удаление цвета, размера и роста из названий групп.
 *
 * Модель размечает каждый токен. Применение и защита бренда/артикула
 * выполняются кодом.
 */

export interface CleanTitleInput {
  id: string;
  title: string;
  brand?: string;
  article?: string;
  size?: string;
  color?: string;
  height?: string;
  category?: string;
}

export type TitleLabel =
  | "color"
  | "size"
  | "height"
  | "article"
  | "brand"
  | "model"
  | "other";

export interface ModelTitleResult {
  id: string;
  labels: string[];
  confidence: number;
}

export interface CleanTitleResult {
  id: string;
  title: string;
  originalTitle: string;
  removed: string[];
  /** Нормализованный цвет, найденный в исходном названии. */
  color?: string;
  confidence: number;
}

export const CLEANUP_PROMPT_VERSION = "clean-color-size-height-v4";

const REMOVABLE_LABELS = new Set<TitleLabel>(["color", "size", "height"]);

/** Разбивает название на слова, сохраняя порядок. */
export function tokenizeTitle(title: string): string[] {
  return title.trim().split(/\s+/).filter(Boolean);
}

const SIZE_LABEL_RE =
  /^(?:размер(?:ы|ов|ам|ами|ах|ом|е)?|розмір(?:и|ів|ам|ами|ах|ом|і)?|sizes?)$/u;

/**
 * Убирает служебные подписи размера перед отправкой в LLM.
 *
 * Удаляется только отдельное слово: «розмір», «розмір:», «(розмір)»,
 * «size», но не «розмірний».
 */
export function normalizeTitleBeforeLlm(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !SIZE_LABEL_RE.test(normalizeToken(token)))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function brandProtected(token: string, brand?: string): boolean {
  const clean = normalizeToken(token);
  if (!clean || !brand) return false;
  return tokenizeTitle(brand)
    .map(normalizeToken)
    .some((brandWord) => brandWord === clean);
}

/** Артикул защищаем только при точном совпадении с полем article. */
function articleProtected(token: string, article?: string): boolean {
  const clean = normalizeToken(token);
  const normalizedArticle = article ? normalizeToken(article) : "";
  return Boolean(clean && normalizedArticle && clean === normalizedArticle);
}

export function isTitleLabel(value: string): value is TitleLabel {
  return (
    value === "color" ||
    value === "size" ||
    value === "height" ||
    value === "article" ||
    value === "brand" ||
    value === "model" ||
    value === "other"
  );
}

function isNumericToken(token: string): boolean {
  return /^\d+(?:[.,]\d+)?$/.test(normalizeToken(token));
}

function sizeIsNumeric(size: string): boolean {
  return /^\d+(?:[.,]\d+)?$/.test(normalizeToken(size));
}

/** Индекс последнего токена, точно совпадающего с размером из данных. */
function findSizeAnchor(tokens: string[], size?: string): number | null {
  if (!size?.trim()) return null;
  const normalized = normalizeToken(size);
  if (!normalized) return null;
  for (let index = tokens.length - 1; index >= 0; index--) {
    if (normalizeToken(tokens[index]) === normalized) return index;
  }
  return null;
}

const OPEN_BRACKETS = new Map([
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
]);
const CLOSE_BRACKETS = new Map([
  [")", "("],
  ["]", "["],
  ["}", "{"],
]);

/**
 * Убирает одиночные открывающие/закрывающие скобки.
 *
 * Парные скобки сохраняются, например артикул в `(HDSYR_839)`.
 */
export function normalizeTitleAfterLlm(value: string): string {
  const stack: Array<{ close: string; index: number }> = [];
  const remove = new Set<number>();

  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    const close = OPEN_BRACKETS.get(char);
    if (close) {
      stack.push({ close, index });
      continue;
    }

    const open = CLOSE_BRACKETS.get(char);
    if (!open) continue;

    const last = stack[stack.length - 1];
    if (last && last.close === char) {
      stack.pop();
    } else {
      remove.add(index);
    }
  }

  for (const item of stack) remove.add(item.index);

  let result = "";
  for (let index = 0; index < value.length; index++) {
    if (!remove.has(index)) result += value[index];
  }

  return result
    .replace(/[([{]\s*[)\]}]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/^[\s,;:]+|[\s,;:]+$/g, "")
    .trim();
}

/** Применяет разметку модели: labels -> очищенное название. */
export function applyModelResults(
  inputs: CleanTitleInput[],
  results: ModelTitleResult[],
): CleanTitleResult[] {
  const resultById = new Map(results.map((result) => [result.id, result]));

  return inputs.map((input) => {
    const tokens = tokenizeTitle(input.title);
    const modelResult = resultById.get(input.id);
    const labels =
      modelResult &&
      modelResult.confidence >= 0.5 &&
      modelResult.labels.length === tokens.length
        ? modelResult.labels
        : null;
    const sizeAnchor = findSizeAnchor(tokens, input.size);
    const remove = new Set<number>();
    const colors: string[] = [];

    if (labels) {
      labels.forEach((rawLabel, index) => {
        if (!isTitleLabel(rawLabel) || !REMOVABLE_LABELS.has(rawLabel)) {
          return;
        }

        const token = tokens[index];
        if (brandProtected(token, input.brand)) return;
        if (articleProtected(token, input.article)) return;
        if (rawLabel === "color") colors.push(normalizeToken(token));

        // Числа до найденного размера — это, скорее всего, номер модели.
        // Для буквенного размера разрешаем одно число непосредственно перед ним.
        if (
          rawLabel === "size" &&
          sizeAnchor !== null &&
          index < sizeAnchor &&
          isNumericToken(token) &&
          (sizeIsNumeric(input.size ?? "") || index !== sizeAnchor - 1)
        ) {
          return;
        }

        remove.add(index);
      });
    }

    // Если в данных есть размер, удаляем его даже при неполной разметке модели.
    if (sizeAnchor !== null) remove.add(sizeAnchor);

    // «см» — служебная единица размера. Если рядом удалили число,
    // убираем и её, чтобы не оставалось «327 см».
    for (let index = 0; index < tokens.length; index++) {
      if (normalizeToken(tokens[index]) !== "см") continue;
      if (remove.has(index - 1) || remove.has(index + 1)) remove.add(index);
    }

    const removedTokens = tokens.filter((_, index) => remove.has(index));
    const cleaned = normalizeTitleAfterLlm(
      tokens
        .filter((_, index) => !remove.has(index))
        .join(" "),
    );

    const safeCleaned =
      cleaned.length >= 2 && /[\p{L}\p{N}]/u.test(cleaned)
        ? cleaned
        : input.title;

    return {
      id: input.id,
      title: safeCleaned,
      originalTitle: input.title,
      removed: safeCleaned === input.title ? [] : removedTokens,
      color: colors.length > 0 ? colors.join(" ") : undefined,
      confidence: modelResult?.confidence ?? 0,
    };
  });
}

/** Сообщения для OpenRouter. */
export function buildCleanupMessages(inputs: CleanTitleInput[]) {
  return [
    {
      role: "system" as const,
      content:
        "Ты размечаешь токены в названиях групп товаров. Тебе дают JSON-массив групп: id, title, tokens, а также brand, article, size, color, height, category. Поля-подсказки могут быть пустыми — это нормально.\n\n" +
        "Верни для каждой группы массив labels строго той же длины, что и tokens, в том же порядке. Каждый элемент — одна метка: color, size, height, article, brand, model или other.\n\n" +
        "color — слово или словосочетание, обозначающее цвет: простой, составной через дефис, составной через пробел, с модификаторами вроде «светло», «тёмно», «очень тёмный». Удаляется.\n\n" +
        "size — любое обозначение размера: XS, S, M, L, XL, XXL, 2XL, 3XL, 4XL, 5XL, XXXL, числовые размеры, размеры в скобках, несколько токенов размера подряд. Удаляется.\n\n" +
        "height — число или диапазон, обозначающий рост: 98, 102, 110-112, 110–112, 108 см. Это не номер модели и не размер одежды. Удаляется.\n\n" +
        "article — артикул или код варианта. Он не обязан быть в скобках, может быть числовым, буквенным или смешанным, может содержать дефисы. Не удаляется.\n\n" +
        "brand — бренд или производитель. Может отсутствовать. model — номер или название модели; может отсутствовать. article, brand и model не удаляются.\n\n" +
        "other — всё остальное. Если сомневаешься между размером и кодом модели/артикулом — ставь other, а не size. Если сомневаешься между цветом и обычным прилагательным — ставь other. Не придумывай отсутствующие поля. Не переписывай title.",
    },
    {
      role: "user" as const,
      content: JSON.stringify(
        inputs.map((input) => ({
          id: input.id,
          title: input.title,
          tokens: tokenizeTitle(input.title),
          brand: input.brand ?? "",
          article: input.article ?? "",
          size: input.size ?? "",
          color: input.color ?? "",
          height: input.height ?? "",
          category: input.category ?? "",
        })),
      ),
    },
  ];
}

/** JSON-схема ответа для structured output. */
export const CLEANUP_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["results"],
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "labels", "confidence"],
        properties: {
          id: { type: "string" },
          labels: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "color",
                "size",
                "height",
                "article",
                "brand",
                "model",
                "other",
              ],
            },
          },
          confidence: { type: "number" },
        },
      },
    },
  },
} as const;
