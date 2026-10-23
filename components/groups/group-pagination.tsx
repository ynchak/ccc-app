"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowLeftDoubleIcon,
  ArrowRight01Icon,
  ArrowRightDoubleIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PAGE_SIZE_OPTIONS,
  type PageSize,
} from "@/lib/pagination";

/**
 * Управление страницами списка групп.
 */
export function GroupPagination({
  page,
  totalPages,
  start,
  end,
  totalItems,
  pageSize,
  showPageSize = true,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  start: number;
  end: number;
  totalItems: number;
  pageSize: PageSize;
  showPageSize?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
}) {
  if (totalItems === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b py-2 text-sm">
      <span className="text-muted-foreground">
        Групи {start}–{end} з {totalItems}
      </span>

      {showPageSize ? (
        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground">На сторінці</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) =>
              onPageSizeChange(Number(value) as PageSize)
            }
          >
            <SelectTrigger size="sm" className="w-20">
              <SelectValue>{(value: string | null) => value ?? "50"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div
        className={`flex items-center gap-1 ${showPageSize ? "" : "ml-auto"}`}
      >
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          aria-label="Перша сторінка"
          title="Перша сторінка"
        >
          <HugeiconsIcon icon={ArrowLeftDoubleIcon} />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Попередня сторінка"
          title="Попередня сторінка"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} />
        </Button>

        <span className="min-w-28 px-2 text-center text-muted-foreground">
          Сторінка {page} з {totalPages}
        </span>

        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Наступна сторінка"
          title="Наступна сторінка"
        >
          <HugeiconsIcon icon={ArrowRight01Icon} />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          aria-label="Остання сторінка"
          title="Остання сторінка"
        >
          <HugeiconsIcon icon={ArrowRightDoubleIcon} />
        </Button>
      </div>
    </div>
  );
}
