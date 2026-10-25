/**
 * Текст названий товаров и групп.
 *
 * Экспорт из CSV иногда содержит python-подобное экранирование:
 * `Short 5\'\' 42` или `шаль м\'ятний`. Для отображения, поиска и
 * сравнения нужен обычный текст без обратных слэшей.
 */

/** Убирает обратное экранирование кавычек, слэшей и дробной черты. */
export function unescapeTitle(value: string): string {
  return value.replace(/\\(['"\\/])/g, "$1");
}

/**
 * Делает первую букву названия заглавной.
 *
 * Если название начинается не с буквы (цифра, кавычка, скобка), оно не
 * меняется: «2XL шорти» и «"Гірка" костюм» остаются как есть.
 */
export function capitalizeTitle(value: string): string {
  const first = value.charAt(0);
  if (!/\p{L}/u.test(first)) return value;
  return first.toLocaleUpperCase("uk") + value.slice(1);
}
