"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  CheckmarkCircleIcon,
  FileImportIcon,
  GroupLayersIcon,
  Menu01Icon,
  SidebarLeft01Icon,
} from "@hugeicons/core-free-icons";

import { AppSidebar } from "@/components/app-sidebar";
import {
  MergeGroupsDialog,
  MoveProductsDialog,
} from "@/components/groups/group-dialogs";
import { GroupSection } from "@/components/groups/group-section";
import { MergeSuggestionsDialog } from "@/components/groups/merge-suggestions-dialog";
import { GroupPagination } from "@/components/groups/group-pagination";
import { ProductSelectionBar } from "@/components/groups/product-selection-bar";
import { GroupFilterBar, GroupHeaderControls } from "@/components/groups/group-toolbar";
import { ProductDetailsDialog } from "@/components/groups/product-details-dialog";
import { ImportDialog } from "@/components/import/import-dialog";
import { Toaster } from "@/components/toaster";
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PRODUCT_DRAG_TYPE, hasDragType, readDragIds } from "@/lib/dnd";
import { exportXlsx } from "@/lib/export/xlsx";
import { paginate } from "@/lib/pagination";
import { groupsLabel, productsLabel } from "@/lib/plural";
import {
  useAppStore,
  useVisibleGroups,
} from "@/lib/store/app-store";
import { notify } from "@/lib/store/toast-store";
import type { Group, Product } from "@/lib/types";

/** Зона создания новой группы перетаскиванием. */
function NewGroupDropZone({
  onCreate,
}: {
  onCreate: (productIds: number[]) => Promise<void>;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      onDragOver={(event) => {
        if (!hasDragType(event, PRODUCT_DRAG_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setIsDragOver(true);
      }}
      onDragLeave={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          event.currentTarget.contains(event.relatedTarget)
        ) {
          return;
        }
        setIsDragOver(false);
      }}
      onDrop={(event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragOver(false);
        if (!hasDragType(event, PRODUCT_DRAG_TYPE)) return;
        const ids = readDragIds(event, PRODUCT_DRAG_TYPE);
        if (ids.length > 0) void onCreate(ids);
      }}
      className={`mt-4 flex items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-sm transition-colors ${
        isDragOver
          ? "border-foreground/40 bg-accent text-foreground"
          : "border-border text-muted-foreground"
      }`}
    >
      <HugeiconsIcon icon={Add01Icon} className="size-4" />
      Перетягніть товари сюди, щоб створити нову групу
    </div>
  );
}

/**
 * Основной экран приложения.
 */
export function AppShell() {
  const init = useAppStore((s) => s.init);
  const datasets = useAppStore((s) => s.datasets);
  const activeDatasetId = useAppStore((s) => s.activeDatasetId);
  const groups = useAppStore((s) => s.groups);
  const products = useAppStore((s) => s.products);
  const productToGroup = useAppStore((s) => s.productToGroup);
  const undoStack = useAppStore((s) => s.undoStack);
  const mergeSuggestions = useAppStore((s) => s.mergeSuggestions);
  const page = useAppStore((s) => s.page);
  const pageSize = useAppStore((s) => s.pageSize);
  const setPage = useAppStore((s) => s.setPage);
  const setPageSize = useAppStore((s) => s.setPageSize);
  const isLoading = useAppStore((s) => s.isLoading);
  const lastSavedAt = useAppStore((s) => s.lastSavedAt);
  const deleteGroup = useAppStore((s) => s.deleteGroup);
  const undo = useAppStore((s) => s.undo);
  const createGroupFromProducts = useAppStore((s) => s.createGroupFromProducts);
  const detachProducts = useAppStore((s) => s.detachProducts);
  const cleanTitlesWithLlm = useAppStore((s) => s.cleanTitlesWithLlm);

  const visibleGroups = useVisibleGroups();

  const categoryGroupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const group of visibleGroups) {
      counts.set(group.categoryId, (counts.get(group.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [visibleGroups]);

  const pageData = useMemo(
    () => paginate(visibleGroups, page, pageSize),
    [visibleGroups, page, pageSize],
  );

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isCleaningTitles, setIsCleaningTitles] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [mergeGroupIds, setMergeGroupIds] = useState<number[] | null>(null);
  const [moveProductIds, setMoveProductIds] = useState<number[] | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [exportWarnings, setExportWarnings] = useState<string[] | null>(null);

  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [activeDatasetId, pageData.page, pageSize]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      void undo().then((ok) => {
        if (ok) notify("Дію скасовано");
      });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo]);

  const activeDataset = datasets.find((d) => d.id === activeDatasetId) ?? null;

  const exportIssues = useMemo(() => {
    const issues: string[] = [];
    const productsWithoutGroup = [...products.values()].filter(
      (product) => !productToGroup.has(product.id),
    );
    if (productsWithoutGroup.length > 0) {
      issues.push(
        `Товарів без групи: ${productsWithoutGroup.length}. Їх буде експортовано з порожньою групою.`,
      );
    }

    const emptyTitleGroups = [...groups.values()].filter(
      (group) => !group.title.trim(),
    );
    if (emptyTitleGroups.length > 0) {
      issues.push(`Груп із порожньою назвою: ${emptyTitleGroups.length}.`);
    }

    const titlesByCategory = new Map<string, Set<string>>();
    for (const group of groups.values()) {
      const categories = titlesByCategory.get(group.titleKey) ?? new Set();
      categories.add(group.categoryId);
      titlesByCategory.set(group.titleKey, categories);
    }
    const duplicateAcrossCategories = [...titlesByCategory.values()].filter(
      (categories) => categories.size > 1,
    ).length;
    if (duplicateAcrossCategories > 0) {
      issues.push(
        `Назв, які трапляються в різних категоріях: ${duplicateAcrossCategories}.`,
      );
    }

    return issues;
  }, [products, productToGroup, groups]);

  const runExport = async () => {
    if (!activeDataset) return;
    setIsExporting(true);
    try {
      await exportXlsx(
        [...products.values()],
        [...groups.values()],
        productToGroup,
        activeDataset.name,
      );
      notify("XLSX-файл сформовано", "success");
    } catch {
      notify("Не вдалося сформувати XLSX", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = () => {
    if (!activeDataset) return;
    if (products.size === 0) {
      notify("У файлі немає товарів для експорту", "error");
      return;
    }
    if (exportIssues.length > 0) {
      setExportWarnings(exportIssues);
      return;
    }
    void runExport();
  };

  const handleUndo = () => {
    void undo().then((ok) => {
      if (ok) notify("Дію скасовано");
      else notify("Більше немає що скасовувати");
    });
  };

  const handleCleanTitles = async () => {
    if (isCleaningTitles) return;
    setIsCleaningTitles(true);
    try {
      const result = await cleanTitlesWithLlm();
      if (result.total === 0) {
        notify("Немає автоматичних груп для очищення");
      } else if (result.skipped) {
        notify("LLM не налаштована — назви не змінено", "error");
      } else {
        const parts = [
          result.cleaned > 0 ? `очищено назв: ${result.cleaned}` : null,
          result.merged > 0 ? `об’єднано за назвою: ${result.merged}` : null,
          result.modelMerged > 0
            ? `об’єднано за моделлю: ${result.modelMerged}`
            : null,
          result.suggestions.length > 0
            ? `пропозицій: ${result.suggestions.length}`
            : null,
          result.failed > 0 ? `не оброблено: ${result.failed}` : null,
        ].filter(Boolean);
        const message =
          parts.length > 0 ? parts.join(", ") : "Змін немає";
        const hasProblem = result.failed > 0 || result.jevFailed;
        notify(
          result.jevFailed
            ? `${message}. Jev не зміг перевірити моделі.`
            : message,
          hasProblem ? "error" : "success",
        );
      }
    } catch (caught) {
      notify(
        caught instanceof Error
          ? caught.message
          : "Не вдалося очистити назви",
        "error",
      );
    } finally {
      setIsCleaningTitles(false);
    }
  };

  const handleCreateFromSelected = async () => {
    const groupId = await createGroupFromProducts([
      ...useAppStore.getState().selectedProductIds,
    ]);
    if (groupId === null) {
      notify("Не вдалося створити групу: товари з різних категорій", "error");
      return;
    }
    notify("Товари згруповано", "success");
  };

  const handleDetachSelected = async () => {
    const ok = await detachProducts([
      ...useAppStore.getState().selectedProductIds,
    ]);
    if (!ok) {
      notify("Немає що виносити в окремі групи");
      return;
    }
    notify("Товари винесено в окремі групи", "success");
  };

  const handleDropNewGroup = async (productIds: number[]) => {
    const groupId = await createGroupFromProducts(productIds);
    if (groupId === null) {
      notify("Не можна об’єднати товари з різних категорій", "error");
      return;
    }
    notify("Товари згруповано", "success");
  };

  const handleMergeGroup = useCallback((target: Group) => {
    setMergeGroupIds([target.id]);
  }, []);

  const handleMoveProduct = useCallback((product: Product) => {
    setMoveProductIds([product.id]);
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <AppSidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onImport={() => setImportOpen(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
          <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-2 px-4 py-2.5">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Відкрити список файлів"
            >
              <HugeiconsIcon icon={Menu01Icon} />
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden lg:inline-flex"
              onClick={() => setSidebarCollapsed((value) => !value)}
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

            <div className="flex w-40 min-w-0 shrink-0 flex-col sm:w-52">
              <span className="truncate text-sm font-semibold">
                {activeDataset?.name ?? "Файл не завантажено"}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {activeDataset
                  ? `${productsLabel(products.size)} · ${groupsLabel(groups.size)}`
                  : "Завантажте CSV, щоб почати групування"}
              </span>
            </div>

            {activeDataset ? (
              <div className="min-w-0 flex-1">
                <GroupHeaderControls
                  onExport={handleExport}
                  isExporting={isExporting}
                  onUndo={handleUndo}
                  canUndo={undoStack.length > 0}
                  onCleanTitles={() => void handleCleanTitles()}
                  isCleaning={isCleaningTitles}
                  suggestionCount={mergeSuggestions.length}
                  onOpenSuggestions={() => setSuggestionsOpen(true)}
                />
              </div>
            ) : (
              <div className="flex-1" />
            )}

            <div className="flex items-center gap-2">
              {lastSavedAt ? (
                <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                  <HugeiconsIcon
                    icon={CheckmarkCircleIcon}
                    className="size-3.5"
                  />
                  Збережено
                </span>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() => setImportOpen(true)}
              >
                <HugeiconsIcon icon={FileImportIcon} data-icon="inline-start" />
                CSV
              </Button>
            </div>
          </div>

          {activeDataset ? (
            <div className="border-t px-4 py-2">
              <div className="mx-auto w-full max-w-[1440px]">
                <GroupFilterBar
                  onMergeSelected={() =>
                    setMergeGroupIds([
                      ...useAppStore.getState().selectedGroupIds,
                    ])
                  }
                />
              </div>
            </div>
          ) : null}
        </header>

        <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-4">
            {!activeDataset ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={FileImportIcon} />
                  </EmptyMedia>
                  <EmptyTitle>Файл не завантажено</EmptyTitle>
                  <EmptyDescription>
                    Завантажте CSV з товарами — вони автоматично згрупуються
                    за спільними посиланнями на фото, а потім Jev перевірить,
                    чи не є різні групи варіантами однієї моделі. Далі групи
                    можна редагувати вручну та експортувати в XLSX.
                  </EmptyDescription>
                </EmptyHeader>
                <Button onClick={() => setImportOpen(true)}>
                  <HugeiconsIcon
                    icon={FileImportIcon}
                    data-icon="inline-start"
                  />
                  Завантажити CSV
                </Button>
              </Empty>
            ) : visibleGroups.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={GroupLayersIcon} />
                  </EmptyMedia>
                  <EmptyTitle>Нічого не знайдено</EmptyTitle>
                  <EmptyDescription>
                    Змініть пошук, фільтр категорії або швидкий фільтр.
                  </EmptyDescription>
                </EmptyHeader>
                <Button
                  variant="outline"
                  onClick={() => {
                    useAppStore.getState().setSearch("");
                    useAppStore.getState().setCategoryFilter(null);
                    useAppStore.getState().setQuickFilter("all");
                  }}
                >
                  Скинути фільтри
                </Button>
              </Empty>
            ) : (
              <>
                <GroupPagination
                  page={pageData.page}
                  totalPages={pageData.totalPages}
                  start={pageData.start}
                  end={pageData.end}
                  totalItems={pageData.totalItems}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />

                <div className="flex flex-col">
                  {pageData.items.map((group, index) => {
                    const previous = pageData.items[index - 1];
                    const showCategoryHeader =
                      !previous || previous.categoryId !== group.categoryId;
                    const groupCount =
                      categoryGroupCounts.get(group.categoryId) ?? 0;

                    return (
                      <Fragment key={group.id}>
                        {showCategoryHeader ? (
                          <div className="sticky top-0 z-30 -mx-4 flex items-baseline gap-2 border-b bg-background px-4 py-2">
                            <h2 className="text-sm font-semibold">
                              {group.categoryTitle || "Без категорії"}
                            </h2>
                            <span className="text-xs text-muted-foreground">
                              {groupsLabel(groupCount)}
                            </span>
                          </div>
                        ) : null}

                        <GroupSection
                          group={group}
                          onMerge={handleMergeGroup}
                          onDelete={setDeleteTarget}
                          onMoveProduct={handleMoveProduct}
                          onDetailsProduct={setDetailsTarget}
                        />
                      </Fragment>
                    );
                  })}
                </div>
                <NewGroupDropZone onCreate={handleDropNewGroup} />
                <GroupPagination
                  page={pageData.page}
                  totalPages={pageData.totalPages}
                  start={pageData.start}
                  end={pageData.end}
                  totalItems={pageData.totalItems}
                  pageSize={pageSize}
                  showPageSize={false}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </>
            )}
          </div>
        </main>
      </div>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <MergeSuggestionsDialog
        open={suggestionsOpen}
        onOpenChange={setSuggestionsOpen}
      />

      <MergeGroupsDialog
        initialGroupIds={mergeGroupIds ?? []}
        open={mergeGroupIds !== null}
        onOpenChange={(open) => {
          if (!open) setMergeGroupIds(null);
        }}
      />

      <MoveProductsDialog
        productIds={moveProductIds ?? []}
        open={moveProductIds !== null}
        onOpenChange={(open) => {
          if (!open) setMoveProductIds(null);
        }}
      />

      <ProductDetailsDialog
        product={detailsTarget}
        open={detailsTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDetailsTarget(null);
        }}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити групу?</AlertDialogTitle>
            <AlertDialogDescription>
              Група № {deleteTarget?.number} «{deleteTarget?.title}» буде
              видалено. Її товари не
              зникнуть: кожен перейде в окрему групу або в наявну
              групу з такою самою назвою.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) void deleteGroup(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Видалити
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={exportWarnings !== null}
        onOpenChange={(open) => {
          if (!open) setExportWarnings(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Перевірка перед експортом</AlertDialogTitle>
            <AlertDialogDescription>
              Знайдено особливості, які варто перевірити:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {exportWarnings?.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setExportWarnings(null);
                void runExport();
              }}
            >
              Все одно експортувати
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isLoading ? (
        <div className="pointer-events-none fixed right-4 bottom-4 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm">
          Обробка…
        </div>
      ) : null}

      <ProductSelectionBar
        onMoveSelected={() =>
          setMoveProductIds([
            ...useAppStore.getState().selectedProductIds,
          ])
        }
        onCreateGroup={() => void handleCreateFromSelected()}
        onDetach={() => void handleDetachSelected()}
      />

      <Toaster />
    </div>
  );
}
