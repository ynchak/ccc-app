"use client";

import { useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  Delete02Icon,
  Edit02Icon,
  FileImportIcon,
  Folder01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";

import { LogoutButton } from "@/components/auth/logout-button";
import { BrandMark } from "@/components/brand-mark";
import { ThemeSelect } from "@/components/theme-select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { groupsLabel, productsLabel } from "@/lib/plural";
import { useAppStore } from "@/lib/store/app-store";
import { notify } from "@/lib/store/toast-store";
import type { Dataset } from "@/lib/types";

/** Дата импорта в коротком виде. */
function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

/**
 * Левая панель: список файлов, тема и загрузка CSV.
 */
export function AppSidebar({
  open,
  collapsed,
  onClose,
  onImport,
}: {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onImport: () => void;
}) {
  const datasets = useAppStore((s) => s.datasets);
  const activeDatasetId = useAppStore((s) => s.activeDatasetId);
  const switchDataset = useAppStore((s) => s.switchDataset);
  const removeDataset = useAppStore((s) => s.removeDataset);
  const renameDataset = useAppStore((s) => s.renameDataset);

  const [deleteTarget, setDeleteTarget] = useState<Dataset | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const cancelEditRef = useRef(false);
  const savingRef = useRef(false);
  const finishedRef = useRef(false);

  const selectDataset = (datasetId: number) => {
    if (datasetId !== activeDatasetId) void switchDataset(datasetId);
    onClose();
  };

  const startRename = (dataset: Dataset) => {
    cancelEditRef.current = false;
    finishedRef.current = false;
    setEditingId(dataset.id);
    setDraftName(dataset.name);
  };

  const saveRename = async () => {
    if (editingId === null || savingRef.current || finishedRef.current) return;
    if (cancelEditRef.current) {
      cancelEditRef.current = false;
      return;
    }
    savingRef.current = true;

    const value = draftName.trim();
    if (!value) {
      notify("Назва файлу не може бути порожньою", "error");
      finishedRef.current = true;
      setEditingId(null);
      savingRef.current = false;
      return;
    }

    const ok = await renameDataset(editingId, value);
    finishedRef.current = true;
    savingRef.current = false;
    setEditingId(null);
    if (!ok) notify("Не вдалося перейменувати файл", "error");
  };

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:hidden" : ""}`}
      >
        <div className="flex items-center gap-2 border-b px-4 py-4">
          <BrandMark className="size-5" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">Akin</h1>
            <p className="truncate text-xs text-muted-foreground">
              групування товарів
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto lg:hidden"
            onClick={onClose}
            aria-label="Закрити меню"
          >
            <HugeiconsIcon icon={Cancel01Icon} />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 py-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Файли
            </span>
            <span className="text-xs text-muted-foreground">{datasets.length}</span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
            {datasets.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                Файлів поки немає. Завантажте CSV, щоб почати.
              </div>
            ) : (
              datasets.map((dataset) => {
                const active = dataset.id === activeDatasetId;
                const editing = editingId === dataset.id;

                return (
                  <div
                    key={dataset.id}
                    className={`group/file relative rounded-lg border transition-colors ${
                      active
                        ? "border-foreground/20 bg-accent"
                        : "border-transparent hover:bg-muted/60"
                    }`}
                  >
                    {editing ? (
                      <div className="flex flex-col gap-1 p-2">
                        <Input
                          value={draftName}
                          autoFocus
                          onChange={(event) => setDraftName(event.target.value)}
                          onBlur={() => void saveRename()}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void saveRename();
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              cancelEditRef.current = true;
                              setEditingId(null);
                            }
                          }}
                          className="h-8 text-sm"
                          aria-label="Назва файлу"
                          title="Enter — зберегти, Esc — скасувати"
                        />
                        <span className="px-1 text-[11px] text-muted-foreground">
                          Enter — зберегти, Esc — скасувати
                        </span>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => selectDataset(dataset.id)}
                          className="flex w-full flex-col gap-1 px-3 py-2.5 pr-10 text-left"
                        >
                          <span className="flex items-center gap-1.5">
                            <HugeiconsIcon
                              icon={Folder01Icon}
                              className="size-3.5 shrink-0 text-muted-foreground"
                            />
                            <span className="truncate text-sm font-medium">
                              {dataset.name}
                            </span>
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {productsLabel(dataset.rowCount)} ·{" "}
                            {groupsLabel(dataset.groupCount)}
                          </span>
                          <span className="text-[11px] text-muted-foreground/70">
                            {formatDate(dataset.importedAt)}
                          </span>
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="absolute top-2 right-2"
                                aria-label={`Дії з файлом ${dataset.name}`}
                              />
                            }
                          >
                            <HugeiconsIcon icon={MoreHorizontalIcon} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                onClick={() => startRename(dataset)}
                              >
                                <HugeiconsIcon
                                  icon={Edit02Icon}
                                  data-icon="inline-start"
                                />
                                Перейменувати
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget(dataset)}
                            >
                              <HugeiconsIcon
                                icon={Delete02Icon}
                                data-icon="inline-start"
                              />
                              Видалити
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-auto flex items-center gap-2 border-t p-3">
          <Button className="flex-1 justify-start" onClick={onImport}>
            <HugeiconsIcon icon={FileImportIcon} data-icon="inline-start" />
            Завантажити CSV
          </Button>
          <LogoutButton />
          <ThemeSelect />
        </div>
      </aside>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити файл?</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteTarget?.name}» буде видалено разом із товарами та групами.
              Дію не можна скасувати.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) void removeDataset(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Видалити
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
