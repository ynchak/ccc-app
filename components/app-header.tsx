"use client";

import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Menu01Icon,
  SidebarLeft01Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";

/**
 * Общий хедер приложения: список файлов, название датасета и слот для
 * контролов конкретного флоу.
 */
export function AppHeader({
  datasetName,
  datasetSubtitle,
  onOpenSidebar,
  onToggleSidebar,
  sidebarCollapsed,
  controls,
  trailing,
  subheader,
}: {
  datasetName: string;
  datasetSubtitle: string;
  onOpenSidebar?: () => void;
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
  controls?: ReactNode;
  trailing?: ReactNode;
  subheader?: ReactNode;
}) {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-2 px-4 py-2.5">
        {onOpenSidebar ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={onOpenSidebar}
            aria-label="Відкрити список файлів"
          >
            <HugeiconsIcon icon={Menu01Icon} />
          </Button>
        ) : null}

        {onToggleSidebar ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden lg:inline-flex"
            onClick={onToggleSidebar}
            aria-label={
              sidebarCollapsed
                ? "Показати список файлів"
                : "Приховати список файлів"
            }
            title={
              sidebarCollapsed
                ? "Показати список файлів"
                : "Приховати список файлів"
            }
          >
            <HugeiconsIcon icon={SidebarLeft01Icon} />
          </Button>
        ) : null}

        <div className="flex w-40 min-w-0 shrink-0 flex-col sm:w-52">
          <span className="truncate text-sm font-semibold">{datasetName}</span>
          <span className="truncate text-xs text-muted-foreground">
            {datasetSubtitle}
          </span>
        </div>

        {controls ? (
          <div className="min-w-0 flex-1">{controls}</div>
        ) : (
          <div className="flex-1" />
        )}

        {trailing ? (
          <div className="flex items-center gap-2">{trailing}</div>
        ) : null}
      </div>

      {subheader ? (
        <div className="border-t px-4 py-2">
          <div className="mx-auto w-full max-w-[1440px]">{subheader}</div>
        </div>
      ) : null}
    </header>
  );
}
