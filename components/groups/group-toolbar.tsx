"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  Download01Icon,
  FilterIcon,
  GridViewIcon,
  GroupLayersIcon,
  Loading03Icon,
  Refresh01Icon,
  Search01Icon,
  SortingAZ01Icon,
  SparklesIcon,
  Tick02Icon,
  Undo02Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  CARD_SIZE_OPTIONS,
  type CardSize,
} from "@/lib/card-size";
import {
  useAppStore,
  useCategories,
  useCounters,
  type QuickFilter,
  type SortBy,
} from "@/lib/store/app-store";

/** Подписи вариантов сортировки. */
const SORT_LABELS: Record<SortBy, string> = {
  order: "За порядком",
  title: "За названием",
  count: "По количеству",
  category: "По категории",
};

/** Быстрые фильтры. */
const QUICK_FILTERS: { value: QuickFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "singles", label: "Одиночные" },
];

/** Галочка выбранного пункта меню. */
function MenuCheck({ checked }: { checked: boolean }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
      {checked ? (
        <HugeiconsIcon icon={Tick02Icon} className="size-3.5" />
      ) : null}
    </span>
  );
}

/**
 * Основные контролы в шапке: поиск, категория, сортировка, размер карточек.
 */
export function GroupHeaderControls({
  onExport,
  isExporting,
  onUndo,
  canUndo,
  onCleanTitles,
  isCleaning,
}: {
  onExport: () => void;
  isExporting: boolean;
  onUndo: () => void;
  canUndo: boolean;
  onCleanTitles: () => void;
  isCleaning: boolean;
}) {
  const search = useAppStore((s) => s.search);
  const setSearch = useAppStore((s) => s.setSearch);
  const categoryFilter = useAppStore((s) => s.categoryFilter);
  const setCategoryFilter = useAppStore((s) => s.setCategoryFilter);
  const sortBy = useAppStore((s) => s.sortBy);
  const setSortBy = useAppStore((s) => s.setSortBy);
  const resort = useAppStore((s) => s.resort);
  const cardSize = useAppStore((s) => s.cardSize);
  const setCardSize = useAppStore((s) => s.setCardSize);

  const categories = useCategories();

  const categoryLabel = (value: string | null) => {
    if (value === null) return "Все категории";
    return (
      categories.find((category) => category.id === value)?.title ??
      (value === "" ? "Без категории" : value)
    );
  };

  const sortLabel = (value: SortBy) => SORT_LABELS[value] ?? "Сортировка";

  const cardSizeLabel = (value: CardSize) =>
    CARD_SIZE_OPTIONS.find((option) => option.value === value)?.label ??
    "Средние";

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <div className="relative min-w-48 flex-1">
        <HugeiconsIcon
          icon={Search01Icon}
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск по названию, артикулу или id…"
          className="pl-8"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant={categoryFilter !== null ? "secondary" : "outline"}
              size="icon"
              aria-label="Фильтр по категории"
              title={`Категория: ${categoryLabel(categoryFilter)}`}
            />
          }
        >
          <HugeiconsIcon icon={FilterIcon} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56 max-w-80">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setCategoryFilter(null)}>
              <MenuCheck checked={categoryFilter === null} />
              <span className="truncate">Все категории</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {categories.map((category) => (
              <DropdownMenuItem
                key={category.id || "no-category"}
                onClick={() => setCategoryFilter(category.id)}
              >
                <MenuCheck checked={categoryFilter === category.id} />
                <span className="min-w-0 truncate" title={category.title}>
                  {category.title}
                </span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {category.count}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label="Сортировка"
              title={`Сортировка: ${sortLabel(sortBy)}`}
            />
          }
        >
          <HugeiconsIcon icon={SortingAZ01Icon} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuGroup>
            {(Object.keys(SORT_LABELS) as SortBy[]).map((value) => (
              <DropdownMenuItem key={value} onClick={() => setSortBy(value)}>
                <MenuCheck checked={sortBy === value} />
                {SORT_LABELS[value]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={resort}>
              <HugeiconsIcon
                icon={Refresh01Icon}
                className="size-3.5 text-muted-foreground"
              />
              Пересортировать сейчас
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label="Размер карточек"
              title={`Карточки: ${cardSizeLabel(cardSize)}`}
            />
          }
        >
          <HugeiconsIcon icon={GridViewIcon} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuGroup>
            {CARD_SIZE_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setCardSize(option.value)}
              >
                <MenuCheck checked={cardSize === option.value} />
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        size="icon"
        onClick={onCleanTitles}
        disabled={isCleaning}
        aria-label="Очистить названия групп ИИ"
        title={isCleaning ? "Очистка названий…" : "Очистить названия групп ИИ"}
      >
        <HugeiconsIcon
          icon={isCleaning ? Loading03Icon : SparklesIcon}
          className={isCleaning ? "animate-spin" : ""}
        />
      </Button>

      <Button
        variant="outline"
        size="icon"
        onClick={resort}
        aria-label="Пересортировать по текущему правилу"
        title="Пересортировать по текущему правилу"
      >
        <HugeiconsIcon icon={Refresh01Icon} />
      </Button>

      <Button variant="outline" onClick={onUndo} disabled={!canUndo}>
        <HugeiconsIcon icon={Undo02Icon} data-icon="inline-start" />
        Отменить
      </Button>

      <Button onClick={onExport} disabled={isExporting}>
        <HugeiconsIcon icon={Download01Icon} data-icon="inline-start" />
        {isExporting ? "Экспорт…" : "Экспорт XLSX"}
      </Button>
    </div>
  );
}

/**
 * Вторая строка шапки: быстрые фильтры, счётчики и массовые действия.
 */
export function GroupFilterBar({
  onMergeSelected,
}: {
  onMergeSelected: () => void;
}) {
  const quickFilter = useAppStore((s) => s.quickFilter);
  const setQuickFilter = useAppStore((s) => s.setQuickFilter);
  const selectedGroupIds = useAppStore((s) => s.selectedGroupIds);
  const clearGroupSelection = useAppStore((s) => s.clearGroupSelection);
  const counters = useCounters();

  const filterCount = (value: QuickFilter): number => {
    switch (value) {
      case "singles":
        return counters.singles;
      default:
        return counters.groups;
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {QUICK_FILTERS.map((filter) => {
            const count = filterCount(filter.value);
            const active = quickFilter === filter.value;
            return (
              <Button
                key={filter.value}
                size="xs"
                variant={active ? "secondary" : "ghost"}
                onClick={() => setQuickFilter(filter.value)}
                className={active ? "font-medium" : "text-muted-foreground"}
              >
                {filter.label}
                <span className="text-[11px] text-muted-foreground">
                  {count}
                </span>
              </Button>
            );
          })}
        </div>

        <span className="ml-auto text-xs text-muted-foreground">
          {counters.products} товаров · {counters.groups} групп
          {counters.singles > 0 ? ` · ${counters.singles} одиночных` : ""}
          {counters.productsWithoutPhotos > 0
            ? ` · без фото: ${counters.productsWithoutPhotos}`
            : ""}
        </span>
      </div>

      {selectedGroupIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">
            Выбрано групп: {selectedGroupIds.size}
          </span>
          <Button size="sm" onClick={onMergeSelected}>
            <HugeiconsIcon icon={GroupLayersIcon} data-icon="inline-start" />
            Объединить
          </Button>
          <Button size="sm" variant="ghost" onClick={clearGroupSelection}>
            <HugeiconsIcon icon={Cancel01Icon} data-icon="inline-start" />
            Снять выбор
          </Button>
        </div>
      ) : null}
    </div>
  );
}
