/** Варианты количества групп на странице. */
export const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

/** Размер страницы по умолчанию. */
export const DEFAULT_PAGE_SIZE: PageSize = 50;

/** Проверяет, что значение можно использовать как размер страницы. */
export function isPageSize(value: unknown): value is PageSize {
  return (
    typeof value === "number" &&
    (PAGE_SIZE_OPTIONS as readonly number[]).includes(value)
  );
}

/** Результат разбиения списка на страницы. */
export interface PageResult<T> {
  items: T[];
  /** Актуальная страница после ограничения диапазоном. */
  page: number;
  totalPages: number;
  totalItems: number;
  /** Номер первого элемента на странице (1-based), 0 для пустого списка. */
  start: number;
  /** Номер последнего элемента на странице (1-based). */
  end: number;
}

/** Разбивает список на страницы. */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): PageResult<T> {
  const safePageSize = pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE;
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const from = (safePage - 1) * safePageSize;
  const pageItems = items.slice(from, from + safePageSize);

  return {
    items: pageItems,
    page: safePage,
    totalPages,
    totalItems,
    start: totalItems === 0 ? 0 : from + 1,
    end: from + pageItems.length,
  };
}
