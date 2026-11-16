/**
 * Словарь цветов для детерминированного удаления из названий.
 *
 * В CSV цвет почти всегда русский («Черный»), а в названии товара он может
 * быть английским («Black»). Поэтому для одного канонического цвета собраны
 * словоформы на русском, украинском и английском языках.
 *
 * Словарь используется как страховка поверх разметки LLM: если модель
 * пометила цвет как модель или «other», код всё равно удалит его из названия.
 */

export interface ColorDefinition {
  /** Канонический идентификатор цвета. */
  id: string;
  /** Основы прилагательных: к ним добавляются окончания. */
  stems?: string[];
  /** Неизменяемые слова и английские названия. */
  words?: string[];
}

/**
 * Окончания прилагательных и кратких форм.
 *
 * Набор намеренно широкий: русские и украинские цвета часто отличаются
 * окончанием, а в названиях встречаются и полные, и краткие формы.
 */
const ADJECTIVE_ENDINGS = [
  "",
  // русский
  "ый",
  "ий",
  "ой",
  "ая",
  "яя",
  "ое",
  "ее",
  "ые",
  "ие",
  "ого",
  "его",
  "ому",
  "ему",
  "ым",
  "им",
  "ых",
  "их",
  "ую",
  "юю",
  "ою",
  "ею",
  "ей",
  // украинский
  "ій",
  "а",
  "я",
  "е",
  "є",
  "і",
  "ї",
  "у",
  "ю",
  "ою",
  "ею",
  "им",
];

export const COLOR_DEFINITIONS: ColorDefinition[] = [
  {
    id: "black",
    stems: ["черн", "чёрн", "чорн"],
    words: ["black", "noir"],
  },
  {
    id: "white",
    stems: ["бел", "біл", "белоснежн", "білосніжн", "молочн"],
    words: ["white", "ivory", "milky"],
  },
  {
    id: "beige",
    stems: ["бежев", "бежов", "песочн", "пісочн", "кремов"],
    words: ["beige", "cream", "sand", "taupe", "беж"],
  },
  {
    id: "grey",
    stems: [
      "сер",
      "сір",
      "графитов",
      "графітов",
      "дымчат",
      "димчаст",
      "серебрист",
      "срібн",
      "серебрян",
    ],
    words: ["grey", "gray", "silver", "charcoal"],
  },
  {
    id: "brown",
    stems: ["коричнев", "шоколадн"],
    words: ["brown", "chocolate", "coffee"],
  },
  {
    id: "red",
    stems: ["красн", "червон", "ал", "багров", "багрян", "малинов"],
    words: ["red", "scarlet", "crimson"],
  },
  {
    id: "pink",
    stems: ["розов", "рожев", "пудров"],
    words: ["pink"],
  },
  {
    id: "purple",
    stems: ["фиолетов", "фіолетов", "пурпурн", "пурпуров", "лавандов"],
    words: ["purple", "violet", "lavender", "лаванда"],
  },
  {
    id: "lilac",
    stems: ["сиренев", "бузков", "лилов"],
    words: ["lilac", "сирень"],
  },
  {
    id: "blue",
    stems: [
      "син",
      "голуб",
      "блакитн",
      "васильков",
      "волошков",
      "бирюзов",
      "бірюзов",
      "небесн",
    ],
    words: ["blue", "navy", "turquoise", "teal", "skyblue"],
  },
  {
    id: "green",
    stems: [
      "зелен",
      "зелён",
      "оливков",
      "салатов",
      "изумрудн",
      "смарагдов",
    ],
    words: ["green", "olive", "khaki", "emerald", "хаки", "олива"],
  },
  {
    id: "mint",
    stems: ["мятн", "ментолов"],
    words: ["mint", "menthol"],
  },
  {
    id: "yellow",
    stems: ["желт", "жёлт", "жовт", "горчичн", "гірчичн", "золот"],
    words: ["yellow", "mustard", "gold", "golden"],
  },
  {
    id: "orange",
    stems: [
      "оранжев",
      "помаранчев",
      "терракотов",
      "теракотов",
      "кораллов",
      "коралов",
      "персиков",
    ],
    words: ["orange", "terracotta", "coral", "peach", "терракота"],
  },
  {
    id: "burgundy",
    stems: ["бордов", "вишнев", "сливов"],
    words: ["burgundy", "maroon", "wine", "бордо"],
  },
  {
    id: "fuchsia",
    stems: ["фуксиев", "фуксієв"],
    words: ["fuchsia", "magenta", "фуксия", "фуксии", "фуксию", "фуксией"],
  },
];

/**
 * Модификаторы цвета: «светло-бежевый», «очень тёмный бордовый», light blue.
 * Удаляются вместе с соседним цветом, но сами по себе цветом не считаются.
 */
const COLOR_MODIFIERS = new Set([
  "светлый",
  "светлая",
  "светлое",
  "светлые",
  "светло",
  "темный",
  "тёмный",
  "темная",
  "тёмная",
  "темное",
  "тёмное",
  "темные",
  "тёмные",
  "темно",
  "тёмно",
  "очень",
  "яркий",
  "яркая",
  "яркое",
  "яркие",
  "ярко",
  "бледный",
  "бледная",
  "бледное",
  "бледные",
  "бледно",
  "насыщенный",
  "насыщенная",
  "насыщенное",
  "насыщенные",
  "насыщенно",
  "пастельный",
  "пастельная",
  "пастельное",
  "пастельные",
  "light",
  "dark",
  "very",
  "pale",
  "bright",
  "deep",
  "pastel",
]);

/** Служебные слова, которые могут попасть в поле цвета. */
const COLOR_STOP_WORDS = new Set([
  "с",
  "со",
  "и",
  "з",
  "і",
  "та",
  "with",
  "and",
  "цвет",
  "цвета",
  "цвету",
  "цветом",
  "цвете",
  "колір",
  "кольору",
  "кольором",
  "кольорі",
  "кольори",
  "кольорів",
  "color",
  "colour",
  "colors",
  "colours",
]);

/** Приводит слово к виду, по которому ищутся цвета. */
export function normalizeColorWord(value: string): string {
  return value
    .toLocaleLowerCase("uk")
    .replace(/['’ʼ`]/g, "")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/** Индекс: нормализованное слово → канонический цвет. */
const COLOR_WORD_INDEX = buildColorWordIndex();

function buildColorWordIndex(): Map<string, string> {
  const index = new Map<string, string>();

  for (const definition of COLOR_DEFINITIONS) {
    for (const word of definition.words ?? []) {
      const normalized = normalizeColorWord(word);
      if (normalized && !index.has(normalized)) {
        index.set(normalized, definition.id);
      }
    }

    for (const stem of definition.stems ?? []) {
      for (const ending of new Set(ADJECTIVE_ENDINGS)) {
        const word = `${stem}${ending}`;
        // Короткие основы без окончания слишком похожи на обычные слова.
        if (word.length < 3 || (ending === "" && word.length < 4)) continue;
        if (!index.has(word)) index.set(word, definition.id);
      }
    }
  }

  return index;
}

/**
 * Канонические цвета, к которым относится слово.
 *
 * Токен может быть составным: «светло-бежевое», «black/white». Тогда цвет
 * ищется и в целом токене, и в его частях.
 */
export function colorIdsForWord(word: string): string[] {
  const normalized = normalizeColorWord(word);
  if (!normalized) return [];

  const parts = normalized.split(/[-–—/]+/).filter(Boolean);
  const candidates = parts.length > 1 ? [normalized, ...parts] : [normalized];
  const ids: string[] = [];

  for (const candidate of candidates) {
    const id = COLOR_WORD_INDEX.get(candidate);
    if (id && !ids.includes(id)) ids.push(id);
  }

  return ids;
}

/** Является ли слово модификатором цвета. */
export function isColorModifier(word: string): boolean {
  return COLOR_MODIFIERS.has(normalizeColorWord(word));
}

/** Слова из поля цвета, которые не являются модификаторами/служебными. */
export function hintColorWords(colorHint?: string): string[] {
  if (!colorHint?.trim()) return [];

  return colorHint
    .split(/[^\p{L}\p{N}]+/u)
    .map(normalizeColorWord)
    .filter((word) => word.length >= 3)
    .filter((word) => !COLOR_MODIFIERS.has(word))
    .filter((word) => !COLOR_STOP_WORDS.has(word));
}

/**
 * Индексы токенов названия, которые являются цветом.
 *
 * Если поле цвета заполнено, его слова тоже считаются цветом — это ловит
 * редкие названия, которых нет в словаре. Но цвета из словаря удаляются
 * всегда, даже когда поле цвета пустое.
 */
export function findColorIndexes(
  tokens: string[],
  colorHint?: string,
): Set<number> {
  const hintWords = new Set(hintColorWords(colorHint));
  const indexes = new Set<number>();

  tokens.forEach((token, index) => {
    const normalized = normalizeColorWord(token);
    if (!normalized) return;
    if (colorIdsForWord(token).length > 0 || hintWords.has(normalized)) {
      indexes.add(index);
    }
  });

  return indexes;
}
