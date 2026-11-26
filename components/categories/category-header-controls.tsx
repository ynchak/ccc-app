"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Cancel01Icon,
  Download01Icon,
  FileImportIcon,
  FilterIcon,
  GroupLayersIcon,
  Search01Icon,
  Tick02Icon,
  Undo02Icon,
} from "@hugeicons/core-free-icons";

import { CardSizeMenu } from "@/components/groups/card-size-menu";
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
import type { CardWidth } from "@/lib/card-size";
import type { CategoryRef } from "@/lib/types";

function MenuCheck({ checked }: { checked: boolean }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
      {checked ? (
        <HugeiconsIcon icon={Tick02Icon} className="size-3.5" />
      ) : null}
    </span>
  );
}

/** Контролы хедера для потока категорий. */
export function CategoryHeaderControls({
  search,
  onSearchChange,
  cardSize,
  onCardSizeChange,
  onImport,
  onAddCategory,
  onExport,
  canExport,
  isExporting,
  onTransition,
  isTransitioning,
  addCategoryDisabled,
  onUndo,
  canUndo,
  isUndoing,
  categories,
  categoryFilter,
  onCategoryFilterChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  cardSize: CardWidth;
  onCardSizeChange: (value: CardWidth) => void;
  onImport: () => void;
  onAddCategory: () => void;
  onExport: () => void;
  canExport: boolean;
  isExporting: boolean;
  onTransition: () => void;
  isTransitioning: boolean;
  addCategoryDisabled: boolean;
  onUndo: () => void;
  canUndo: boolean;
  isUndoing: boolean;
  categories: (CategoryRef & { count?: number })[];
  categoryFilter: string | null;
  onCategoryFilterChange: (value: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-40 flex-1">
        <HugeiconsIcon
          icon={Search01Icon}
          className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Пошук категорії, групи, ID або артикулу…"
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
              title={
                categoryFilter === null
                  ? "Усі категорії"
                  : categories.find((category) => category.id === categoryFilter)
                      ?.title ?? categoryFilter
              }
            />
          }
        >
          <HugeiconsIcon icon={FilterIcon} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56 max-w-80">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => onCategoryFilterChange(null)}>
              <MenuCheck checked={categoryFilter === null} />
              <span className="truncate">Усі категорії</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {categories.map((category) => (
              <DropdownMenuItem
                key={category.id || "no-category"}
                onClick={() => onCategoryFilterChange(category.id)}
              >
                <MenuCheck checked={categoryFilter === category.id} />
                <span className="min-w-0 truncate" title={category.title}>
                  {category.title}
                </span>
                {category.count !== undefined ? (
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {category.count}
                  </span>
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <CardSizeMenu value={cardSize} onChange={onCardSizeChange} />

      <Button
        variant="outline"
        size="icon"
        onClick={onImport}
        aria-label="Завантажити CSV"
        title="Завантажити CSV"
      >
        <HugeiconsIcon icon={FileImportIcon} />
      </Button>

      <Button
        variant="outline"
        onClick={onAddCategory}
        disabled={addCategoryDisabled}
      >
        <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />
        Категорія
      </Button>

      <Button variant="outline" onClick={onUndo} disabled={!canUndo || isUndoing}>
        <HugeiconsIcon icon={Undo02Icon} data-icon="inline-start" />
        {isUndoing ? "Скасування…" : "Скасувати"}
      </Button>

      <Button variant="outline" onClick={onExport} disabled={!canExport || isExporting}>
        <HugeiconsIcon icon={Download01Icon} data-icon="inline-start" />
        {isExporting ? "Експорт…" : "Експорт змін"}
      </Button>

      <Button onClick={onTransition} disabled={isTransitioning}>
        <HugeiconsIcon icon={GroupLayersIcon} data-icon="inline-start" />
        {isTransitioning ? "Перехід…" : "До групування"}
      </Button>
    </div>
  );
}
