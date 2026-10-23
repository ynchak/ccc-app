"use client";

import { memo, useRef, useState, type DragEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  Edit02Icon,
  GripVerticalIcon,
  GroupLayersIcon,
  MoreHorizontalIcon,
  Refresh01Icon,
  SparklesIcon,
  TrashIcon,
} from "@hugeicons/core-free-icons";

import { ProductCard } from "@/components/groups/product-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  GROUP_DRAG_TYPE,
  PRODUCT_DRAG_TYPE,
  hasDragType,
  readDragIds,
  setDragIds,
} from "@/lib/dnd";
import { CARD_GRID_CLASSES } from "@/lib/card-size";
import { normalizeTitle } from "@/lib/grouping/cluster";
import {
  useAppStore,
  useGroupProducts,
} from "@/lib/store/app-store";
import { notify } from "@/lib/store/toast-store";
import type { Group, Product } from "@/lib/types";

/**
 * Подпись количества товаров с правильным склонением.
 */
function productsLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} товар`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} товара`;
  }
  return `${count} товаров`;
}

/**
 * Секция группы: название, мета-информация и карточки её товаров.
 * Принимает товары и другие группы через drag & drop.
 */
export const GroupSection = memo(function GroupSection({
  group,
  onMerge,
  onDelete,
  onMoveProduct,
  onDetailsProduct,
}: {
  group: Group;
  onMerge: (group: Group) => void;
  onDelete: (group: Group) => void;
  onMoveProduct: (product: Product) => void;
  onDetailsProduct: (product: Product) => void;
}) {
  const products = useGroupProducts(group);
  const isSelected = useAppStore((s) => s.selectedGroupIds.has(group.id));
  const cardSize = useAppStore((s) => s.cardSize);
  const toggleGroupSelection = useAppStore((s) => s.toggleGroupSelection);
  const renameGroup = useAppStore((s) => s.renameGroup);
  const mergeGroups = useAppStore((s) => s.mergeGroups);
  const moveProducts = useAppStore((s) => s.moveProducts);
  const selectProducts = useAppStore((s) => s.selectProducts);
  const resetGroupTitle = useAppStore((s) => s.resetGroupTitle);

  const [isOpen, setIsOpen] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(group.title);
  const cancelEditRef = useRef(false);
  const savingRef = useRef(false);

  // Синхронизация названия, если группа изменилась снаружи.
  const [prevTitle, setPrevTitle] = useState(group.title);
  if (!isEditing && prevTitle !== group.title) {
    setPrevTitle(group.title);
    setDraftTitle(group.title);
  }


  const saveTitle = async () => {
    if (!isEditing) return;
    if (cancelEditRef.current) {
      cancelEditRef.current = false;
      return;
    }
    if (savingRef.current) return;
    savingRef.current = true;

    const value = draftTitle.trim();
    if (!value) {
      notify("Название группы не может быть пустым", "error");
      setDraftTitle(group.title);
      setIsEditing(false);
      savingRef.current = false;
      return;
    }

    const key = normalizeTitle(value);
    const duplicate = [...useAppStore.getState().groups.values()].find(
      (candidate) =>
        candidate.id !== group.id &&
        candidate.categoryId === group.categoryId &&
        candidate.titleKey === key,
    );

    setIsEditing(false);
    if (value === group.title) {
      savingRef.current = false;
      return;
    }

    const ok = await renameGroup(group.id, value);
    savingRef.current = false;
    if (!ok) {
      notify("Не удалось переименовать группу", "error");
      setDraftTitle(group.title);
      return;
    }
    if (duplicate) {
      notify("Названия совпали — группы объединены", "success");
    } else {
      notify("Название группы сохранено", "success");
    }
  };

  const handleGroupDragStart = (event: DragEvent<HTMLButtonElement>) => {
    const state = useAppStore.getState();
    const ids =
      state.selectedGroupIds.has(group.id) && state.selectedGroupIds.size > 1
        ? [...state.selectedGroupIds]
        : [group.id];
    setDragIds(event, GROUP_DRAG_TYPE, ids);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (
      !hasDragType(event, PRODUCT_DRAG_TYPE) &&
      !hasDragType(event, GROUP_DRAG_TYPE)
    ) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }
    setIsDragOver(false);
  };

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragOver(false);

    if (hasDragType(event, GROUP_DRAG_TYPE)) {
      const sourceIds = readDragIds(event, GROUP_DRAG_TYPE).filter(
        (id) =>
          id !== group.id && useAppStore.getState().groups.has(id),
      );
      if (sourceIds.length === 0) return;
      const ok = await mergeGroups(sourceIds, group.id);
      if (!ok) {
        notify("Нельзя объединить группы из разных категорий", "error");
      } else {
        notify(
          sourceIds.length === 1
            ? "Группы объединены"
            : "Несколько групп объединены",
          "success",
        );
      }
      return;
    }

    if (hasDragType(event, PRODUCT_DRAG_TYPE)) {
      const productIds = readDragIds(event, PRODUCT_DRAG_TYPE);
      if (productIds.length === 0) return;
      const ok = await moveProducts(productIds, group.id);
      if (!ok) {
        notify(
          "Товар нельзя перенести в группу другой категории",
          "error",
        );
      } else {
        notify(
          productIds.length === 1
            ? "Товар перенесён"
            : `Перенесено товаров: ${productIds.length}`,
          "success",
        );
      }
    }
  };

  return (
    <section
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(event) => void handleDrop(event)}
      className="scroll-mt-40 pt-2 pb-3"
    >
      <Card
        size="sm"
        className={`gap-0 py-0 transition-colors ${
          isDragOver ? "bg-accent/30 ring-2 ring-foreground/30" : ""
        }`}
      >
        <CardHeader className="border-b pt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex cursor-grab items-center justify-center text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
              draggable
              onDragStart={handleGroupDragStart}
              aria-label="Перетащить группу"
              title="Перетащить группу на другую группу, чтобы объединить"
            >
              <HugeiconsIcon icon={GripVerticalIcon} className="size-4" />
            </button>

            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleGroupSelection(group.id)}
              aria-label={`Выбрать группу ${group.title}`}
            />

            <div className="relative flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => setIsOpen((value) => !value)}
                disabled={isEditing}
                aria-expanded={isOpen}
                aria-controls={`group-content-${group.id}`}
                aria-label={`${isOpen ? "Свернуть" : "Развернуть"} группу ${group.title}`}
                className="absolute inset-0 cursor-pointer rounded-md bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default"
              />

              <span
                className="pointer-events-none shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
                title="Номер группы"
              >
                № {group.number}
              </span>

              {isEditing ? (
                <Input
                  value={draftTitle}
                  autoFocus
                  onChange={(event) => setDraftTitle(event.target.value)}
                  onBlur={() => void saveTitle()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void saveTitle();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelEditRef.current = true;
                      setDraftTitle(group.title);
                      setIsEditing(false);
                    }
                  }}
                  className="relative z-10 h-8 min-w-0 flex-1 text-sm font-semibold"
                  aria-label="Название группы"
                />
              ) : (
                <button
                  type="button"
                  className="relative z-10 max-w-full min-w-0 cursor-text text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  onClick={() => setIsEditing(true)}
                  title="Нажмите, чтобы переименовать"
                >
                  <h2
                    className="truncate text-sm leading-snug font-semibold hover:underline hover:decoration-dotted hover:underline-offset-4"
                    title={group.title}
                  >
                    {group.title}
                  </h2>
                </button>
              )}

              {group.titleSource === "manual" ? (
                <HugeiconsIcon
                  icon={Edit02Icon}
                  className="pointer-events-none size-3.5 shrink-0 text-muted-foreground"
                  aria-label="Название изменено вручную"
                />
              ) : group.titleSource === "llm" ? (
                <HugeiconsIcon
                  icon={SparklesIcon}
                  className="pointer-events-none size-3.5 shrink-0 text-muted-foreground"
                  aria-label="Название очищено ИИ"
                />
              ) : null}

              <span className="pointer-events-none ml-auto shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                {productsLabel(group.productIds.length)}
              </span>

              <HugeiconsIcon
                icon={ArrowDown01Icon}
                className={`pointer-events-none size-4 shrink-0 text-muted-foreground transition-transform ${
                  isOpen ? "" : "-rotate-90"
                }`}
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Действия с группой"
                  />
                }
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <HugeiconsIcon icon={Edit02Icon} data-icon="inline-start" />
                    Переименовать
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onMerge(group)}>
                    <HugeiconsIcon
                      icon={GroupLayersIcon}
                      data-icon="inline-start"
                    />
                    Объединить с…
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      const selectedNow =
                        useAppStore.getState().selectedProductIds;
                      selectProducts(
                        products
                          .map((product) => product.id)
                          .filter((id) => !selectedNow.has(id)),
                      );
                    }}
                  >
                    <HugeiconsIcon
                      icon={GroupLayersIcon}
                      data-icon="inline-start"
                    />
                    Выбрать товары группы
                  </DropdownMenuItem>
                  {group.titleSource === "llm" ? (
                    <DropdownMenuItem
                      onClick={() => {
                        void resetGroupTitle(group.id).then((ok) => {
                          if (ok) notify("Исходное название восстановлено");
                        });
                      }}
                    >
                      <HugeiconsIcon
                        icon={Refresh01Icon}
                        data-icon="inline-start"
                      />
                      Вернуть исходное название
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(group)}
                >
                  <HugeiconsIcon icon={TrashIcon} data-icon="inline-start" />
                  Удалить группу
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        {isOpen ? (
          <CardContent id={`group-content-${group.id}`} className="py-3">
            {products.length > 0 ? (
              <div className={`grid ${CARD_GRID_CLASSES[cardSize]}`}>
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onMove={onMoveProduct}
                    onDetails={onDetailsProduct}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Пустая группа — перетащите сюда товары или переименуйте её.
              </div>
            )}
          </CardContent>
        ) : null}
      </Card>
    </section>
  );
});
