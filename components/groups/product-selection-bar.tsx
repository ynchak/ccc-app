"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Cancel01Icon,
  MoveHorizontalIcon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  useAppStore,
  useSelectedProducts,
} from "@/lib/store/app-store";

/**
 * Плавающая панель действий с выбранными товарами.
 *
 * Находится вне основного потока, чтобы появление панели не перестраивало
 * список карточек и не вызывало скачок layout.
 */
export function ProductSelectionBar({
  onMoveSelected,
  onCreateGroup,
  onDetach,
}: {
  onMoveSelected: () => void;
  onCreateGroup: () => void;
  onDetach: () => void;
}) {
  const selectedCount = useAppStore((s) => s.selectedProductIds.size);
  const clearProductSelection = useAppStore((s) => s.clearProductSelection);
  const selectedProducts = useSelectedProducts();

  if (selectedCount === 0) return null;

  const mixedCategories =
    new Set(selectedProducts.map((product) => product.categoryId)).size > 1;

  return (
    <div className="fixed bottom-4 left-1/2 z-40 flex w-[min(56rem,calc(100vw-2rem))] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl border bg-popover px-3 py-2.5 text-sm shadow-lg">
      <span className="font-medium">Выбрано товаров: {selectedCount}</span>

      <Button
        size="sm"
        onClick={onMoveSelected}
        disabled={mixedCategories}
        title={
          mixedCategories
            ? "Выбраны товары из разных категорий — перенос в одну группу невозможен"
            : undefined
        }
      >
        <HugeiconsIcon icon={MoveHorizontalIcon} data-icon="inline-start" />
        Перенести в группу…
      </Button>

      <Button size="sm" variant="secondary" onClick={onCreateGroup}>
        <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />
        Новая группа из выбранных
      </Button>

      <Button size="sm" variant="ghost" onClick={onDetach}>
        <HugeiconsIcon icon={UnfoldMoreIcon} data-icon="inline-start" />
        Отдельные группы
      </Button>

      <Button
        size="sm"
        variant="ghost"
        onClick={clearProductSelection}
        className="ml-auto"
      >
        <HugeiconsIcon icon={Cancel01Icon} data-icon="inline-start" />
        Снять выбор
      </Button>
    </div>
  );
}
