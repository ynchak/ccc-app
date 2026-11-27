"use client";

import { useMemo, useState } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  Tick02Icon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { matchesCategoryQuery } from "@/lib/category/dictionary";
import type { CategoryRef } from "@/lib/types";

/** Выбор категории с поиском по названию и ID. */
export function CategoryPicker({
  categories,
  value,
  onChange,
  placeholder = "Оберіть категорію",
  className,
  ariaLabel = "Категорія",
}: {
  categories: CategoryRef[];
  value: string;
  onChange: (categoryId: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = categories.find((category) => category.id === value);
  const filtered = useMemo(() => {
    if (!query.trim()) return categories;
    return categories.filter((category) =>
      matchesCategoryQuery(category, query),
    );
  }, [categories, query]);

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverPrimitive.Trigger
        render={
          <Button
            variant="outline"
            className={`h-9 w-full justify-between font-normal ${className ?? ""}`}
            aria-label={ariaLabel}
          />
        }
      >
        <span
          className={`min-w-0 flex-1 truncate text-left ${
            selected ? "" : "text-muted-foreground"
          }`}
        >
          {selected
            ? `${selected.title} (${selected.id})`
            : placeholder}
        </span>
        <HugeiconsIcon
          icon={UnfoldMoreIcon}
          className="size-4 shrink-0 text-muted-foreground"
        />
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          align="start"
          sideOffset={4}
          className="isolate z-50 outline-none"
        >
          <PopoverPrimitive.Popup
            data-slot="category-picker"
            className="w-(--anchor-width) min-w-64 max-w-[calc(100vw-2rem)] rounded-lg bg-popover p-2 text-popover-foreground shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-border/80 outline-none"
          >
            <div className="relative mb-2">
              <HugeiconsIcon
                icon={Search01Icon}
                className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setOpen(false);
                  }
                  if (event.key === "Enter" && filtered[0]) {
                    event.preventDefault();
                    onChange(filtered[0].id);
                    setOpen(false);
                  }
                }}
                placeholder="Пошук за назвою (uk/ru) або ID…"
                aria-label="Пошук категорії"
                className="pl-7"
              />
            </div>

            <div className="flex max-h-64 flex-col overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                  Категорій не знайдено
                </p>
              ) : (
                filtered.map((category) => {
                  const active = category.id === value;
                  return (
                    <button
                      key={category.id || "no-category"}
                      type="button"
                      onClick={() => {
                        onChange(category.id);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent ${
                        active ? "bg-accent/60" : ""
                      }`}
                    >
                      <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
                        {active ? (
                          <HugeiconsIcon icon={Tick02Icon} className="size-3.5" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{category.title}</span>
                        {category.id ? (
                          <span className="block text-[11px] text-muted-foreground">
                            {category.id}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
