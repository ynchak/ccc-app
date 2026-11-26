"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { GridViewIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CARD_WIDTH_MAX,
  CARD_WIDTH_MIN,
  CARD_WIDTH_STEP,
  type CardWidth,
} from "@/lib/card-size";

/** Общий выбор ширины карточек для группировки и потока категорий. */
export function CardSizeMenu({
  value,
  onChange,
}: {
  value: CardWidth;
  onChange: (value: CardWidth) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label="Ширина карток"
            title={`Картки: ${value}px`}
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
            <span className="tabular-nums text-muted-foreground">{value} px</span>
          </div>
          <input
            type="range"
            min={CARD_WIDTH_MIN}
            max={CARD_WIDTH_MAX}
            step={CARD_WIDTH_STEP}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            className="h-2 w-full cursor-pointer accent-primary"
            aria-label="Ширина картки в пікселях"
          />
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{CARD_WIDTH_MIN} px</span>
            <span>{CARD_WIDTH_MAX} px</span>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
