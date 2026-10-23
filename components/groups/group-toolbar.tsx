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
  CARD_WIDTH_MAX,
  CARD_WIDTH_MIN,
  CARD_WIDTH_STEP,
} from "@/lib/card-size";
import { groupsLabel, productsLabel, singlesLabel } from "@/lib/plural";
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
  title: "За назвою",
  count: "За кількістю",
  category: "За категорією",
};

/** Быстрые фильтры. */
const QUICK_FILTERS: { value: QuickFilter; label: string }[] = [
  { value: "all", label: "Усі" },
  { value: "singles", label: "Одиночні" },
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
  cleanupRunsLeft,
  cleanupLimitReached,
  suggestionCount,
  onOpenSuggestions,
  onSearchChange,
}: {
  onExport: () => void;
  isExporting: boolean;
  onUndo: () => void;
  canUndo: boolean;
  onCleanTitles: () => void;
  isCleaning: boolean;
  cleanupRunsLeft: number;
  cleanupLimitReached: boolean;
  suggestionCount: number;
  onOpenSuggestions: () => void;
  onSearchChange: (value: string) => void;
}) {
  const search = useAppStore((s) => s.search);
  const categoryFilter = useAppStore((s) => s.categoryFilter);
  const setCategoryFilter = useAppStore((s) => s.setCategoryFilter);
  const sortBy = useAppStore((s) => s.sortBy);
  const setSortBy = useAppStore((s) => s.setSortBy);
  const resort = useAppStore((s) => s.resort);
  const cardSize = useAppStore((s) => s.cardSize);
  const setCardSize = useAppStore((s) => s.setCardSize);

  const categories = useCategories();

  const categoryLabel = (value: string | null) => {
    if (value === null) return "Усі категорії";
    return (
      categories.find((category) => category.id === value)?.title ??
      (value === "" ? "Без категорії" : value)
    );
  };

  const sortLabel = (value: SortBy) => SORT_LABELS[value] ?? "Сортування";



  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <div className="relative min-w-48 flex-1">
        <HugeiconsIcon
          icon={Search01Icon}
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && search) {
              event.preventDefault();
              onSearchChange("");
            }
          }}
          placeholder="Пошук за назвою, артикулом або id…"
          className={search ? "pr-8 pl-8" : "pl-8"}
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label="Очистити пошук"
            title="Очистити пошук"
            className="absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
          </button>
        ) : null}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant={categoryFilter !== null ? "secondary" : "outline"}
              size="icon"
              aria-label="Фільтр за категорією"
              title={`Категорія: ${categoryLabel(categoryFilter)}`}
            />
          }
        >
          <HugeiconsIcon icon={FilterIcon} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56 max-w-80">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setCategoryFilter(null)}>
              <MenuCheck checked={categoryFilter === null} />
              <span className="truncate">Усі категорії</span>
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
              aria-label="Сортування"
              title={`Сортування: ${sortLabel(sortBy)}`}
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
              Пересортувати зараз
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
              aria-label="Ширина карток"
              title={`Картки: ${cardSize}px`}
            />
          }
        >
          <HugeiconsIcon icon={GridViewIcon} />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-64 p-3"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>Ширина картки</span>
              <span className="tabular-nums text-muted-foreground">
                {cardSize} px
              </span>
            </div>
            <input
              type="range"
              min={CARD_WIDTH_MIN}
              max={CARD_WIDTH_MAX}
              step={CARD_WIDTH_STEP}
              value={cardSize}
              onChange={(event) => setCardSize(Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-primary"
              aria-label="Ширина картки в пікселях"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {CARD_WIDTH_MIN} px
              </span>
              <span className="text-xs text-muted-foreground">
                {CARD_WIDTH_MAX} px
              </span>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {suggestionCount > 0 ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={onOpenSuggestions}
          title="Перевірити можливі об’єднання за моделлю"
        >
          <HugeiconsIcon icon={GroupLayersIcon} data-icon="inline-start" />
          Пропозиції: {suggestionCount}
        </Button>
      ) : null}

      <Button
        variant="outline"
        size="icon"
        onClick={onCleanTitles}
        disabled={isCleaning || cleanupLimitReached}
        aria-label={
          cleanupLimitReached
            ? "Ліміт очищення вичерпано"
            : `Очистити назви та перевірити моделі ШІ. Залишилось запусків: ${cleanupRunsLeft}`
        }
        title={
          cleanupLimitReached
            ? "Ліміт ручних очищень вичерпано (2/2)"
            : isCleaning
              ? "Очищення назв і перевірка моделей…"
              : `Очистити назви та перевірити моделі ШІ. Залишилось запусків: ${cleanupRunsLeft}`
        }
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
        aria-label="Пересортувати за поточним правилом"
        title="Пересортувати за поточним правилом"
      >
        <HugeiconsIcon icon={Refresh01Icon} />
      </Button>

      <Button variant="outline" onClick={onUndo} disabled={!canUndo}>
        <HugeiconsIcon icon={Undo02Icon} data-icon="inline-start" />
        Скасувати
      </Button>

      <Button onClick={onExport} disabled={isExporting}>
        <HugeiconsIcon icon={Download01Icon} data-icon="inline-start" />
        {isExporting ? "Експорт…" : "Експорт XLSX"}
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
          {productsLabel(counters.products)} · {groupsLabel(counters.groups)}
          {counters.singles > 0 ? ` · ${singlesLabel(counters.singles)}` : ""}
          {counters.productsWithoutPhotos > 0
            ? ` · без фото: ${counters.productsWithoutPhotos}`
            : ""}
        </span>
      </div>

      {selectedGroupIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">
            Вибрано: {groupsLabel(selectedGroupIds.size)}
          </span>
          <Button size="sm" onClick={onMergeSelected}>
            <HugeiconsIcon icon={GroupLayersIcon} data-icon="inline-start" />
            Об’єднати
          </Button>
          <Button size="sm" variant="ghost" onClick={clearGroupSelection}>
            <HugeiconsIcon icon={Cancel01Icon} data-icon="inline-start" />
            Зняти вибір
          </Button>
        </div>
      ) : null}
    </div>
  );
}
