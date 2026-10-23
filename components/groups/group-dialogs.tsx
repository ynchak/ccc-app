"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Search01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { groupsLabel, productsLabel } from "@/lib/plural";
import { notify } from "@/lib/store/toast-store";
import { useAppStore } from "@/lib/store/app-store";
import type { Group, Product } from "@/lib/types";


/**
 * Диалог объединения групп.
 *
 * Начальный набор — выбранные в тулбаре группы (или текущая группа, если
 * объединение запущено из её меню). Дополнительные группы можно добавить
 * из списка той же категории.
 */
export function MergeGroupsDialog({
  initialGroupIds,
  open,
  onOpenChange,
}: {
  initialGroupIds: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const groups = useAppStore((s) => s.groups);
  const mergeGroups = useAppStore((s) => s.mergeGroups);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  // Сброс при открытии — во время рендера, а не в эффекте.
  const [prevKey, setPrevKey] = useState<string | null>(null);
  const currentKey = open ? initialGroupIds.join(",") : null;
  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    if (currentKey !== null) {
      setSelectedIds(initialGroupIds);
      setTargetId(initialGroupIds[0] ?? null);
      setQuery("");
    }
  }

  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => groups.get(id))
        .filter((g): g is Group => g !== undefined),
    [selectedIds, groups],
  );

  // Кандидаты для добавления — та же категория, что и у первой группы.
  const candidates = useMemo(() => {
    if (selected.length === 0) return [];
    const categoryId = selected[0].categoryId;
    const q = query.trim().toLowerCase();
    return [...groups.values()]
      .filter((group) => group.categoryId === categoryId)
      .filter((group) => !selectedIds.includes(group.id))
      .filter(
        (group) =>
          !q ||
          group.title.toLowerCase().includes(q) ||
          String(group.number).includes(q),
      )
      .sort((a, b) => a.title.localeCompare(b.title, "uk"));
  }, [groups, selected, selectedIds, query]);

  const totalProducts = selected.reduce(
    (sum, group) => sum + group.productIds.length,
    0,
  );
  const mixedCategories =
    new Set(selected.map((group) => group.categoryId)).size > 1;

  const handleMerge = async () => {
    if (targetId === null || selectedIds.length < 2) return;
    const ok = await mergeGroups(selectedIds, targetId);
    if (!ok) {
      notify("Не можна об’єднати групи з різних категорій", "error");
      return;
    }
    notify("Групи об’єднано", "success");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Об’єднати групи</DialogTitle>
          <DialogDescription className="break-words">
            Виберіть групу, яка збереже свою назву. Інші товари
            перейдуть до неї.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-2">
            {selected.map((group) => (
              <label
                key={group.id}
                className={`flex min-w-0 cursor-pointer items-center gap-3 overflow-hidden rounded-lg border p-3 transition-colors ${
                  targetId === group.id
                    ? "border-foreground/25 bg-accent"
                    : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="merge-target"
                  className="accent-primary"
                  checked={targetId === group.id}
                  onChange={() => setTargetId(group.id)}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      № {group.number}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium" title={group.title}>
                      {group.title}
                    </span>
                  </span>
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {productsLabel(group.productIds.length)} ·{" "}
                    {group.categoryTitle || "Без категорії"}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Прибрати групу"
                  onClick={(event) => {
                    event.preventDefault();
                    const next = selectedIds.filter((id) => id !== group.id);
                    setSelectedIds(next);
                    if (targetId === group.id) setTargetId(next[0] ?? null);
                  }}
                >
                  <HugeiconsIcon icon={Add01Icon} className="rotate-45" />
                </Button>
              </label>
            ))}
          </div>

          {selected.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Label>Додати групу</Label>
              <div className="relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Пошук групи…"
                  className="pl-8"
                />
              </div>
              <div className="max-h-48 min-w-0 overflow-y-auto rounded-lg border">
                {candidates.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    Більше немає груп у цій категорії.
                  </p>
                ) : (
                  candidates.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setSelectedIds([...selectedIds, group.id])}
                      className="flex w-full min-w-0 items-center justify-between gap-3 overflow-hidden border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          № {group.number}
                        </span>
                        <span className="min-w-0 flex-1 truncate" title={group.title}>
                          {group.title}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {group.productIds.length}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {mixedCategories ? (
            <p className="text-sm text-destructive">
              Вибрано групи з різних категорій — об’єднання неможливе.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Разом: {productsLabel(totalProducts)}, {groupsLabel(selected.length)}
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Скасувати
          </DialogClose>
          <Button
            onClick={() => void handleMerge()}
            disabled={
              targetId === null || selectedIds.length < 2 || mixedCategories
            }
          >
            Об’єднати
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Диалог переноса одного или нескольких товаров.
 */
export function MoveProductsDialog({
  productIds,
  open,
  onOpenChange,
}: {
  productIds: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const groups = useAppStore((s) => s.groups);
  const products = useAppStore((s) => s.products);
  const moveProducts = useAppStore((s) => s.moveProducts);
  const createGroupFromProducts = useAppStore(
    (s) => s.createGroupFromProducts,
  );
  const detachProducts = useAppStore((s) => s.detachProducts);
  const [query, setQuery] = useState("");

  // Сброс поиска при открытии — во время рендера, а не в эффекте.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setQuery("");
  }

  const selectedProducts = useMemo(
    () =>
      productIds
        .map((id) => products.get(id))
        .filter((product): product is Product => product !== undefined),
    [productIds, products],
  );

  const categories = new Set(
    selectedProducts.map((product) => product.categoryId),
  );
  const mixedCategories = categories.size > 1;
  const categoryId = selectedProducts[0]?.categoryId ?? "";

  // Показываем только группы той же категории — товары не должны её менять.
  const candidates = useMemo(() => {
    if (selectedProducts.length === 0 || mixedCategories) return [];
    const q = query.trim().toLowerCase();
    return [...groups.values()]
      .filter((group) => group.categoryId === categoryId)
      .filter(
        (group) =>
          !q ||
          group.title.toLowerCase().includes(q) ||
          String(group.number).includes(q),
      )
      .sort((a, b) => a.title.localeCompare(b.title, "uk"));
  }, [groups, selectedProducts.length, mixedCategories, categoryId, query]);

  const ids = selectedProducts.map((product) => product.id);

  const handleMove = async (groupId: number) => {
    const ok = await moveProducts(ids, groupId);
    if (!ok) {
      notify("Не вдалося перемістити товари", "error");
      return;
    }
    notify(
      ids.length === 1 ? "Товар переміщено" : `Переміщено товарів: ${ids.length}`,
      "success",
    );
    onOpenChange(false);
  };

  const handleCreate = async () => {
    const groupId = await createGroupFromProducts(ids);
    if (groupId === null) {
      notify("Не вдалося створити групу", "error");
      return;
    }
    notify("Товари згруповано", "success");
    onOpenChange(false);
  };

  const handleDetach = async () => {
    const ok = await detachProducts(ids);
    if (!ok) {
      notify("Немає що виносити в окремі групи");
      return;
    }
    notify("Товари винесено в окремі групи", "success");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {ids.length === 1
              ? "Перемістити товар"
              : `Перемістити товари (${ids.length})`}
          </DialogTitle>
          <DialogDescription className="break-words">
            {selectedProducts.length === 1
              ? selectedProducts[0].goodsTitle
              : mixedCategories
                ? "Вибрано товари з різних категорій."
                : `Категорія: ${
                    selectedProducts[0]?.categoryTitle || "Без категорії"
                  }`}
          </DialogDescription>
        </DialogHeader>

        {mixedCategories ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Перемістити всі вибрані товари в одну групу не можна: вони з різних
            категорій. Можна винести кожен товар в окрему групу.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <HugeiconsIcon
                icon={Search01Icon}
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Пошук групи…"
                className="pl-8"
              />
            </div>

            <div className="max-h-72 min-w-0 overflow-y-auto rounded-lg border">
              {candidates.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  Груп не знайдено. Створіть нову.
                </p>
              ) : (
                candidates.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => void handleMove(group.id)}
                    className="flex w-full min-w-0 items-center justify-between gap-3 overflow-hidden border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        № {group.number}
                      </span>
                      <span className="min-w-0 flex-1 truncate" title={group.title}>
                        {group.title}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {group.productIds.length}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Скасувати
          </DialogClose>
          <Button variant="secondary" onClick={() => void handleDetach()}>
            {ids.length === 1 ? "В окрему групу" : "Кожен окремо"}
          </Button>
          <Button onClick={() => void handleCreate()} disabled={mixedCategories}>
            Створити нову групу
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
