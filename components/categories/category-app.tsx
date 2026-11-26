"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  Delete02Icon,
  Edit02Icon,
  FileImportIcon,
  GroupLayersIcon,
  Menu01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";

import { AddCategoryDialog } from "@/components/categories/add-category-dialog";
import { CategoryGroupDialog } from "@/components/categories/category-group-dialog";
import { CategoryHeaderControls } from "@/components/categories/category-header-controls";
import { CategorySectionBlock } from "@/components/categories/category-section";
import { CategoryImportDialog } from "@/components/categories/category-import-dialog";
import { CategoryPicker } from "@/components/categories/category-picker";
import { AccountControls } from "@/components/account-controls";
import { AppHeader } from "@/components/app-header";
import { BrandMark } from "@/components/brand-mark";
import { Toaster } from "@/components/toaster";
import { GroupPagination } from "@/components/groups/group-pagination";
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
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { buildModelLinks } from "@/lib/category/links";
import { exportCategoryChanges } from "@/lib/export/category-xlsx";
import { paginate, type PageSize } from "@/lib/pagination";
import {
  categoriesLabel,
  clustersLabel,
  groupsLabel,
  productsLabel,
} from "@/lib/plural";
import {
  ATTENTION_SECTION_ID,
  clusterCategories,
  useCategoryCounters,
  useCategoryOptions,
  useCategorySections,
  useCategoryStore,
  type CategorySection,
} from "@/lib/store/category-store";
import {
  CATEGORY_PAGE_SIZE_DEFAULT,
  useCategoryView,
  useCategoryViewStore,
} from "@/lib/store/category-view-store";
import { notify } from "@/lib/store/toast-store";
import type { CategoryCluster, Dataset, Product } from "@/lib/types";


function matchesQuery(
  cluster: CategoryCluster,
  query: string,
  products: Map<number, Product>,
): boolean {
  if (cluster.title.toLowerCase().includes(query)) return true;
  if (String(cluster.number).includes(query)) return true;
  return cluster.productIds.some((productId) => {
    const product = products.get(productId);
    if (!product) return false;
    return (
      product.goodsTitle.toLowerCase().includes(query) ||
      product.goodsArticle.toLowerCase().includes(query) ||
      product.goodsId.toLowerCase().includes(query)
    );
  });
}

function withFilteredClusters(
  section: CategorySection,
  clusters: CategoryCluster[],
  products: Map<number, Product>,
): CategorySection {
  return {
    ...section,
    clusters,
    groupCount: clusters.length,
    productCount: clusters.reduce(
      (sum, cluster) => sum + cluster.productIds.length,
      0,
    ),
    changedCount: clusters.filter((cluster) => {
      if (!cluster.targetCategoryId) return false;
      return cluster.productIds.some((productId) => {
        const product = products.get(productId);
        if (!product) return false;
        return (
          (product.originalCategoryId ?? product.categoryId) !==
          cluster.targetCategoryId
        );
      });
    }).length,
    mixedCount: clusters.filter(
      (cluster) => clusterCategories(cluster, products).length > 1,
    ).length,
  };
}

/** Левая панель потока категорий. */
function CategorySidebar({
  onImport,
  onDelete,
  onClose,
  open,
  collapsed,
}: {
  onImport: () => void;
  onDelete: (dataset: Dataset) => void;
  onClose: () => void;
  open: boolean;
  collapsed: boolean;
}) {
  const datasets = useCategoryStore((state) => state.datasets);
  const activeDatasetId = useCategoryStore((state) => state.activeDatasetId);
  const switchDataset = useCategoryStore((state) => state.switchDataset);
  const renameDataset = useCategoryStore((state) => state.renameDataset);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const pendingRenameRef = useRef<Dataset | null>(null);
  const cancelEditRef = useRef(false);
  const savingRef = useRef(false);
  const finishedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const ignoreBlurRef = useRef(false);

  const startRename = (dataset: Dataset) => {
    pendingRenameRef.current = dataset;
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
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold">Akin</h1>
            <p className="truncate text-xs text-muted-foreground">
              крок 1 · категорії
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={onClose}
            aria-label="Закрити меню"
          >
            <HugeiconsIcon icon={Menu01Icon} />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 py-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Файли категорій
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
                          ref={inputRef}
                          value={draftName}
                          autoFocus
                          onChange={(event) => setDraftName(event.target.value)}
                          onBlur={() => {
                            if (ignoreBlurRef.current) {
                              ignoreBlurRef.current = false;
                              window.requestAnimationFrame(() =>
                                inputRef.current?.focus(),
                              );
                              return;
                            }
                            void saveRename();
                          }}
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
                          onClick={() => {
                            if (!active) void switchDataset(dataset.id);
                            onClose();
                          }}
                          className="flex w-full flex-col gap-1 px-3 py-2.5 pr-10 text-left"
                        >
                          <span className="truncate text-sm font-medium">
                            {dataset.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {productsLabel(dataset.rowCount)} ·{" "}
                            {clustersLabel(
                              dataset.clusterCount ?? dataset.groupCount,
                            )}
                          </span>
                        </button>

                        <DropdownMenu
                          onOpenChangeComplete={(nextOpen) => {
                            const pending = pendingRenameRef.current;
                            if (nextOpen || !pending) return;
                            pendingRenameRef.current = null;
                            cancelEditRef.current = false;
                            finishedRef.current = false;
                            ignoreBlurRef.current = true;
                            window.setTimeout(() => {
                              ignoreBlurRef.current = false;
                            }, 300);
                            setEditingId(pending.id);
                            setDraftName(pending.name);
                          }}
                        >
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
                              onClick={() => onDelete(dataset)}
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

        <div className="mt-auto flex flex-col gap-2 border-t p-3">
          <Button className="justify-start" onClick={onImport}>
            <HugeiconsIcon icon={FileImportIcon} data-icon="inline-start" />
            Завантажити CSV
          </Button>
          <Link
            href="/"
            className={buttonVariants({
              variant: "outline",
              className: "justify-start",
            })}
          >
            <HugeiconsIcon icon={GroupLayersIcon} data-icon="inline-start" />
            До групування
          </Link>
          <AccountControls />
        </div>
      </aside>
    </>
  );
}

/** Экран разнесения товаров по категориям. */
export function CategoryApp() {
  const router = useRouter();
  const init = useCategoryStore((state) => state.init);
  const datasets = useCategoryStore((state) => state.datasets);
  const activeDatasetId = useCategoryStore((state) => state.activeDatasetId);
  const products = useCategoryStore((state) => state.products);
  const clusters = useCategoryStore((state) => state.clusters);
  const cardSize = useCategoryStore((state) => state.cardSize);
  const setCardSize = useCategoryStore((state) => state.setCardSize);
  const selectedClusterIds = useCategoryStore((state) => state.selectedClusterIds);
  const toggleClusterSelection = useCategoryStore(
    (state) => state.toggleClusterSelection,
  );
  const addClusterSelection = useCategoryStore(
    (state) => state.addClusterSelection,
  );
  const removeClusterSelection = useCategoryStore(
    (state) => state.removeClusterSelection,
  );
  const clearClusterSelection = useCategoryStore(
    (state) => state.clearClusterSelection,
  );
  const setClusterTarget = useCategoryStore((state) => state.setClusterTarget);
  const moveClustersToCategory = useCategoryStore(
    (state) => state.moveClustersToCategory,
  );
  const splitClusterByCategory = useCategoryStore(
    (state) => state.splitClusterByCategory,
  );
  const detachProducts = useCategoryStore((state) => state.detachProducts);
  const mergeClusters = useCategoryStore((state) => state.mergeClusters);
  const undo = useCategoryStore((state) => state.undo);
  const canUndo = useCategoryStore((state) => state.undoStack.length > 0);
  const transitionToGrouping = useCategoryStore(
    (state) => state.transitionToGrouping,
  );
  const removeDataset = useCategoryStore((state) => state.removeDataset);
  const isLoading = useCategoryStore((state) => state.isLoading);

  const sections = useCategorySections();
  const counters = useCategoryCounters();
  const categories = useCategoryOptions();
  const categoryFilterOptions = useMemo(
    () =>
      sections
        .filter((section) => !section.isAttention)
        .map((section) => ({
          id: section.id,
          title: section.title,
          count: section.groupCount,
        })),
    [sections],
  );
  const modelLinks = useMemo(
    () => buildModelLinks(clusters.values(), products),
    [clusters, products],
  );

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Dataset | null>(null);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [openedCluster, setOpenedCluster] = useState<{
    datasetId: number | null;
    id: number | null;
  }>({ datasetId: null, id: null });
  const [openedCategoryPage, setOpenedCategoryPage] = useState<{
    datasetId: number | null;
    id: string | null;
  }>({ datasetId: null, id: null });
  const [bulkTargetId, setBulkTargetId] = useState("");
  const mainRef = useRef<HTMLElement>(null);
  const scrollSaveRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef(0);
  const restoredDatasetRef = useRef<string | null>(null);

  const viewKey = String(activeDatasetId ?? "none");
  const view = useCategoryView(activeDatasetId);
  const updateView = useCategoryViewStore((state) => state.updateView);
  const search = view.search;
  const categoryFilter = view.categoryFilter;
  const groupPages = view.groupPages ?? {};
  const groupPageSizes = view.groupPageSizes ?? {};
  const page = view.page ?? 1;
  const pageSize = view.pageSize ?? CATEGORY_PAGE_SIZE_DEFAULT;
  const collapsedSections = useMemo(
    () => new Set(view.collapsedSections),
    [view.collapsedSections],
  );

  const openedClusterId =
    openedCluster.datasetId === activeDatasetId ? openedCluster.id : null;
  const openedCategoryPageId =
    openedCategoryPage.datasetId === activeDatasetId
      ? openedCategoryPage.id
      : null;
  const setOpenedClusterId = useCallback(
    (id: number | null) => {
      setOpenedCluster({ datasetId: activeDatasetId, id });
    },
    [activeDatasetId],
  );
  const setOpenedCategoryPageId = useCallback(
    (id: string | null) => {
      setOpenedCategoryPage({ datasetId: activeDatasetId, id });
    },
    [activeDatasetId],
  );

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (activeDatasetId === null) return;
    const key = String(activeDatasetId);
    if (restoredDatasetRef.current === key) return;
    restoredDatasetRef.current = key;
    const saved =
      useCategoryViewStore.getState().views[key]?.scrollTop ?? 0;
    requestAnimationFrame(() => {
      mainRef.current?.scrollTo({ top: saved });
    });
  }, [activeDatasetId]);

  useEffect(() => {
    return () => {
      if (scrollSaveRef.current) window.clearTimeout(scrollSaveRef.current);
    };
  }, []);

  const setSearch = useCallback(
    (value: string) => updateView(viewKey, { search: value, page: 1, groupPages: {} }),
    [updateView, viewKey],
  );
  const setCategoryFilter = useCallback(
    (value: string | null) => {
      updateView(viewKey, { categoryFilter: value, page: 1, groupPages: {} });
      if (value) {
        const current =
          useCategoryViewStore.getState().views[viewKey]?.collapsedSections ??
          [];
        updateView(viewKey, {
          collapsedSections: current.filter((id) => id !== value),
        });
      }
    },
    [updateView, viewKey],
  );
  const toggleSection = useCallback(
    (sectionId: string) => {
      const current =
        useCategoryViewStore.getState().views[viewKey]?.collapsedSections ?? [];
      const next = current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId];
      updateView(viewKey, { collapsedSections: next });
    },
    [updateView, viewKey],
  );
  const collapseAll = useCallback(() => {
    updateView(viewKey, {
      collapsedSections: sections.map((section) => section.id),
    });
  }, [sections, updateView, viewKey]);
  const expandAll = useCallback(() => {
    updateView(viewKey, { collapsedSections: [] });
  }, [updateView, viewKey]);
  const setGroupPage = useCallback(
    (sectionId: string, page: number) => {
      const current =
        useCategoryViewStore.getState().views[viewKey]?.groupPages ?? {};
      updateView(viewKey, {
        groupPages: { ...current, [sectionId]: page },
      });
    },
    [updateView, viewKey],
  );
  const setGroupPageSize = useCallback(
    (sectionId: string, pageSize: PageSize) => {
      const currentPages =
        useCategoryViewStore.getState().views[viewKey]?.groupPages ?? {};
      const currentSizes =
        useCategoryViewStore.getState().views[viewKey]?.groupPageSizes ?? {};
      updateView(viewKey, {
        groupPages: { ...currentPages, [sectionId]: 1 },
        groupPageSizes: { ...currentSizes, [sectionId]: pageSize },
      });
    },
    [updateView, viewKey],
  );
  const setCategoryPage = useCallback(
    (value: number) => {
      updateView(viewKey, { page: value });
      mainRef.current?.scrollTo({ top: 0 });
    },
    [updateView, viewKey],
  );
  const setCategoryPageSize = useCallback(
    (value: PageSize) => {
      updateView(viewKey, { pageSize: value, page: 1 });
      mainRef.current?.scrollTo({ top: 0 });
    },
    [updateView, viewKey],
  );
  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLElement>) => {
      lastScrollTopRef.current = event.currentTarget.scrollTop;
      if (scrollSaveRef.current) return;
      scrollSaveRef.current = window.setTimeout(() => {
        scrollSaveRef.current = null;
        updateView(viewKey, { scrollTop: lastScrollTopRef.current });
      }, 250);
    },
    [updateView, viewKey],
  );

  const activeDataset = datasets.find((item) => item.id === activeDatasetId) ?? null;
  const query = search.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    const base = categoryFilter
      ? sections.filter((section) => section.id === categoryFilter)
      : sections;
    if (!query) return base;
    return base.flatMap((section) => {
      const categoryMatch =
        section.title.toLowerCase().includes(query) ||
        section.id.toLowerCase().includes(query);
      const matched = categoryMatch
        ? section.clusters
        : section.clusters.filter((cluster) =>
            matchesQuery(cluster, query, products),
          );
      if (!categoryMatch && matched.length === 0) return [];
      return [withFilteredClusters(section, matched, products)];
    });
  }, [sections, query, products, categoryFilter]);

  const categoryPage = useMemo(
    () => paginate(filteredSections, page, pageSize),
    [filteredSections, page, pageSize],
  );
  const openedPageSection =
    openedCategoryPageId === null
      ? null
      : filteredSections.find(
          (section) => section.id === openedCategoryPageId,
        ) ?? null;

  const selectedClusters = useMemo(
    () =>
      [...selectedClusterIds]
        .map((id) => clusters.get(id))
        .filter((cluster): cluster is CategoryCluster => cluster !== undefined),
    [selectedClusterIds, clusters],
  );
  const selectedProductCount = selectedClusters.reduce(
    (sum, cluster) => sum + cluster.productIds.length,
    0,
  );
  const selectedCategoryCount = new Set(
    selectedClusters.map((cluster) => {
      if (cluster.targetCategoryId) return cluster.targetCategoryId;
      const categories = clusterCategories(cluster, products);
      return categories.length > 1
        ? ATTENTION_SECTION_ID
        : categories[0]?.id ?? "";
    }),
  ).size;
  const selectedMixed = selectedClusters.filter(
    (cluster) => clusterCategories(cluster, products).length > 1,
  ).length;
  const openedClusterData =
    openedClusterId === null ? null : clusters.get(openedClusterId) ?? null;

  const isSectionExpanded = (section: CategorySection) =>
    Boolean(query) || !collapsedSections.has(section.id);

  const handleUndo = async () => {
    if (isUndoing) return;
    setIsUndoing(true);
    try {
      const ok = await undo();
      notify(
        ok ? "Останню дію скасовано" : "Більше немає що скасовувати",
        ok ? "success" : "error",
      );
    } finally {
      setIsUndoing(false);
    }
  };

  const openCategoryPage = useCallback(
    (sectionId: string) => {
      setCategoryFilter(null);
      setOpenedCategoryPageId(sectionId);
      mainRef.current?.scrollTo({ top: 0 });
    },
    [setCategoryFilter, setOpenedCategoryPageId],
  );

  const handleExport = async () => {
    if (!activeDataset) return;
    setIsExporting(true);
    try {
      const count = await exportCategoryChanges(
        [...products.values()],
        [...clusters.values()],
        activeDataset.name,
      );
      if (count === 0) notify("Немає змінених категорій для експорту", "error");
      else notify(`Експортовано змінених товарів: ${count}`, "success");
    } catch {
      notify("Не вдалося сформувати XLSX", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const runTransition = async () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    try {
      const datasetId = await transitionToGrouping();
      if (datasetId === null) {
        notify("Не вдалося перейти до групування", "error");
        return;
      }
      notify("Категорії застосовано. Переходимо до групування.", "success");
      router.push("/");
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Не вдалося перейти до групування",
        "error",
      );
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleTransition = () => {
    if (!activeDataset) return;
    if (counters.attention > 0) {
      setTransitionOpen(true);
      return;
    }
    void runTransition();
  };

  const handleBulkMove = async () => {
    if (!bulkTargetId || selectedClusterIds.size === 0) return;
    const category = categories.find((item) => item.id === bulkTargetId);
    if (!category) return;
    const count = await moveClustersToCategory(
      [...selectedClusterIds],
      category.id,
      category.title,
    );
    if (count === 0) {
      notify("Не вдалося перенести групи", "error");
      return;
    }
    notify(
      `${groupsLabel(count)} перенесено в «${category.title}»`,
      "success",
    );
    setBulkTargetId("");
  };

  const handleSplit = async (clusterId: number) => {
    const ok = await splitClusterByCategory(clusterId);
    if (!ok) {
      notify("У групі лише одна категорія", "error");
      return;
    }
    notify("Групу розділено за категоріями", "success");
    setOpenedClusterId(null);
  };

  const handleDetach = async (clusterId: number, productIds: number[]) => {
    const ok = await detachProducts(clusterId, productIds);
    if (ok) notify("Товари відокремлено", "success");
    else notify("Виберіть частину товарів групи, а не всі", "error");
    if (ok) setOpenedClusterId(null);
  };

  const handleMerge = async (firstId: number, secondId: number) => {
    const first = clusters.get(firstId);
    const second = clusters.get(secondId);
    const targetId =
      first && second
        ? first.number <= second.number
          ? first.id
          : second.id
        : firstId;

    const ok = await mergeClusters(firstId, secondId);
    if (!ok) {
      notify("Не вдалося об’єднати групи", "error");
      return;
    }
    notify("Групи об’єднано", "success");
    setOpenedClusterId(targetId);
  };

  const handleSetTarget = async (
    clusterId: number,
    categoryId: string,
    categoryTitle: string,
  ) => {
    const ok = await setClusterTarget(clusterId, categoryId, categoryTitle);
    if (ok) notify(`Групу перенесено в «${categoryTitle}»`, "success");
    else notify("Не вдалося змінити категорію", "error");
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <CategorySidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onImport={() => setImportOpen(true)}
        onDelete={setDeleteTarget}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          datasetName={activeDataset?.name ?? "Категорії"}
          datasetSubtitle={`${categoriesLabel(categories.length)} · ${groupsLabel(counters.clusters)} · ${counters.attention} потребують уваги`}
          onOpenSidebar={() => setSidebarOpen(true)}
          onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
          sidebarCollapsed={sidebarCollapsed}
          controls={
            <CategoryHeaderControls
              search={search}
              onSearchChange={setSearch}
              cardSize={cardSize}
              onCardSizeChange={setCardSize}
              onImport={() => setImportOpen(true)}
              onAddCategory={() => setAddCategoryOpen(true)}
              onExport={() => void handleExport()}
              canExport={
                Boolean(activeDataset) && counters.changedProducts > 0
              }
              isExporting={isExporting}
              onTransition={handleTransition}
              isTransitioning={isTransitioning}
              addCategoryDisabled={!activeDataset}
              onUndo={() => void handleUndo()}
              canUndo={canUndo}
              isUndoing={isUndoing}
              categories={categoryFilterOptions}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
            />
          }
          subheader={
            activeDataset ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{groupsLabel(counters.clusters)}</Badge>
                <Badge variant="outline">
                  {productsLabel(counters.products)}
                </Badge>
                {counters.attention > 0 ? (
                  <Badge variant="destructive">
                    {counters.attention} потребують уваги
                  </Badge>
                ) : null}
                <div className="ml-auto flex items-center gap-1">
                  <Button variant="ghost" size="xs" onClick={expandAll}>
                    Розгорнути всі
                  </Button>
                  <Button variant="ghost" size="xs" onClick={collapseAll}>
                    Згорнути всі
                  </Button>
                </div>
              </div>
            ) : undefined
          }
        />

        <main
          ref={mainRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <div
            className={`mx-auto w-full max-w-[1440px] px-4 py-4 ${
              selectedClusterIds.size > 0 ? "pb-32" : ""
            }`}
          >
            {!activeDataset ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={FileImportIcon} />
                  </EmptyMedia>
                  <EmptyTitle>Файл не завантажено</EmptyTitle>
                  <EmptyDescription>
                    Завантажте CSV — товари згрупуються за фото без урахування
                    категорій, щоб було видно однакові моделі в різних
                    категоріях.
                  </EmptyDescription>
                </EmptyHeader>
                <Button onClick={() => setImportOpen(true)}>
                  <HugeiconsIcon icon={FileImportIcon} data-icon="inline-start" />
                  Завантажити CSV
                </Button>
              </Empty>
            ) : openedCategoryPageId !== null ? (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpenedCategoryPageId(null)}
                  >
                    <HugeiconsIcon
                      icon={ArrowLeft01Icon}
                      data-icon="inline-start"
                    />
                    До категорій
                  </Button>
                </div>

                {openedPageSection ? (
                  <CategorySectionBlock
                    section={openedPageSection}
                    expanded
                    pageMode
                    groupPage={
                      groupPages[openedPageSection.id] ?? 1
                    }
                    groupPageSize={
                      groupPageSizes[openedPageSection.id] ?? 25
                    }
                    products={products}
                    selectedClusterIds={selectedClusterIds}
                    modelLinks={modelLinks}
                    cardSize={cardSize}
                    onToggleSection={toggleSection}
                    onToggleSelect={toggleClusterSelection}
                    onOpen={setOpenedClusterId}
                    onAddSelection={addClusterSelection}
                    onRemoveSelection={removeClusterSelection}
                    onGroupPageChange={setGroupPage}
                    onGroupPageSizeChange={setGroupPageSize}
                  />
                ) : (
                  <Empty className="border">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <HugeiconsIcon icon={FileImportIcon} />
                      </EmptyMedia>
                      <EmptyTitle>Категорію не знайдено</EmptyTitle>
                      <EmptyDescription>
                        Поверніться до списку категорій.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </>
            ) : (
              <>
                <GroupPagination
                  page={categoryPage.page}
                  totalPages={categoryPage.totalPages}
                  start={categoryPage.start}
                  end={categoryPage.end}
                  totalItems={categoryPage.totalItems}
                  pageSize={pageSize}
                  itemsLabel="Категорії"
                  onPageChange={setCategoryPage}
                  onPageSizeChange={setCategoryPageSize}
                />

                <div className="mt-3 flex flex-col gap-2">
                  {categoryPage.items.map((section) => (
                    <CategorySectionBlock
                      key={section.id}
                      section={section}
                      expanded={isSectionExpanded(section)}
                      groupPage={groupPages[section.id] ?? 1}
                      groupPageSize={groupPageSizes[section.id] ?? 25}
                      products={products}
                      selectedClusterIds={selectedClusterIds}
                      modelLinks={modelLinks}
                      cardSize={cardSize}
                      onToggleSection={toggleSection}
                      onToggleSelect={toggleClusterSelection}
                      onOpen={setOpenedClusterId}
                      onOpenPage={openCategoryPage}
                      onAddSelection={addClusterSelection}
                      onRemoveSelection={removeClusterSelection}
                      onGroupPageChange={setGroupPage}
                      onGroupPageSizeChange={setGroupPageSize}
                    />
                  ))}
                </div>

                <GroupPagination
                  page={categoryPage.page}
                  totalPages={categoryPage.totalPages}
                  start={categoryPage.start}
                  end={categoryPage.end}
                  totalItems={categoryPage.totalItems}
                  pageSize={pageSize}
                  showPageSize={false}
                  itemsLabel="Категорії"
                  onPageChange={setCategoryPage}
                  onPageSizeChange={setCategoryPageSize}
                />
              </>
            )}
          </div>
        </main>
      </div>

      {selectedClusterIds.size > 0 ? (
        <div className="fixed right-0 bottom-0 left-0 z-20 border-t bg-background/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur supports-backdrop-filter:bg-background/80 lg:left-72">
          <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 text-sm">
              <span className="font-medium">
                Вибрано {groupsLabel(selectedClusterIds.size)}
              </span>
              <span className="text-muted-foreground">
                {" "}
                · {productsLabel(selectedProductCount)} ·{" "}
                {categoriesLabel(selectedCategoryCount)}
              </span>
              {selectedMixed > 0 ? (
                <span className="block text-xs text-destructive">
                  Серед вибраних є {selectedMixed} змішаних груп — вони будуть
                  повністю перенесені в одну категорію.
                </span>
              ) : null}
            </span>
            <CategoryPicker
              categories={categories}
              value={bulkTargetId}
              onChange={setBulkTargetId}
              placeholder="— Перенести в категорію —"
              ariaLabel="Категорія для перенесення"
              className="w-64"
            />
            <Button
              onClick={() => void handleBulkMove()}
              disabled={!bulkTargetId}
            >
              Перенести
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setBulkTargetId("");
                clearClusterSelection();
              }}
            >
              Очистити
            </Button>
          </div>
        </div>
      ) : null}

      <CategoryGroupDialog
        key={
          openedClusterData
            ? `${openedClusterData.id}-${openedClusterData.productIds.length}`
            : "none"
        }
        cluster={openedClusterData}
        products={products}
        categories={categories}
        links={
          openedClusterData
            ? modelLinks.get(openedClusterData.id) ?? []
            : []
        }
        cardSize={cardSize}
        open={openedClusterData !== null}
        onOpenChange={(open) => {
          if (!open) setOpenedClusterId(null);
        }}
        onSetTarget={(categoryId, categoryTitle) => {
          if (openedClusterData) {
            void handleSetTarget(
              openedClusterData.id,
              categoryId,
              categoryTitle,
            );
          }
        }}
        onSplit={() => {
          if (openedClusterData) void handleSplit(openedClusterData.id);
        }}
        onDetach={(productIds) => {
          if (openedClusterData) {
            void handleDetach(openedClusterData.id, productIds);
          }
        }}
        onMerge={(otherId) => {
          if (openedClusterData) {
            void handleMerge(openedClusterData.id, otherId);
          }
        }}
      />

      <CategoryImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <AddCategoryDialog
        open={addCategoryOpen}
        onOpenChange={setAddCategoryOpen}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити файл?</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteTarget?.name}» буде видалено разом із товарами та
              кластерами. Дію не можна скасувати.
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

      <AlertDialog open={transitionOpen} onOpenChange={setTransitionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Є нерозв’язані групи</AlertDialogTitle>
            <AlertDialogDescription>
              {counters.attention} груп містять товари з різних категорій і ще
              не мають однієї цільової категорії. Можна перейти далі — тоді
              товари залишаться у своїх поточних категоріях, але краще
              розв’язати ці групи.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Повернутися</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setTransitionOpen(false);
                void runTransition();
              }}
            >
              Перейти все одно
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isLoading || isTransitioning ? (
        <div className="pointer-events-none fixed right-4 bottom-4 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm">
          Обробка…
        </div>
      ) : null}

      <Toaster />
    </div>
  );
}
