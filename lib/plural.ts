/** Украинские формы множественного числа. */
export function pluralUk(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function productsLabel(count: number): string {
  return `${count} ${pluralUk(count, "товар", "товари", "товарів")}`;
}

export function groupsLabel(count: number): string {
  return `${count} ${pluralUk(count, "група", "групи", "груп")}`;
}

export function singlesLabel(count: number): string {
  return `${count} ${pluralUk(count, "одинокий", "одинокі", "одиноких")}`;
}
