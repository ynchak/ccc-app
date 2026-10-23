"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { GroupLayersIcon } from "@hugeicons/core-free-icons";

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
import { useAppStore } from "@/lib/store/app-store";
import { notify } from "@/lib/store/toast-store";

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Диалог с парами групп, которые Jev считает вероятными объединениями,
 * но уверенность ниже порога автоматического слияния.
 */
export function MergeSuggestionsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const groups = useAppStore((s) => s.groups);
  const suggestions = useAppStore((s) => s.mergeSuggestions);
  const applyMergeSuggestion = useAppStore((s) => s.applyMergeSuggestion);
  const dismissMergeSuggestion = useAppStore((s) => s.dismissMergeSuggestion);
  const clearMergeSuggestions = useAppStore((s) => s.clearMergeSuggestions);

  const visible = suggestions.filter(
    (suggestion) =>
      groups.has(suggestion.aId) && groups.has(suggestion.bId),
  );

  const handleMerge = async (aId: number, bId: number) => {
    const ok = await applyMergeSuggestion(aId, bId);
    if (ok) notify("Групи об’єднано", "success");
    else notify("Не вдалося об’єднати групи", "error");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Можливі об’єднання за моделлю</DialogTitle>
          <DialogDescription className="break-words">
            Jev знайшов пари з імовірністю 80–95%. Перевірте їх вручну:
            об’єднання можна скасувати кнопкою «Скасувати».
          </DialogDescription>
        </DialogHeader>

        {visible.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Пропозицій немає.
          </p>
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            {visible.map((suggestion) => {
              const a = groups.get(suggestion.aId);
              const b = groups.get(suggestion.bId);
              if (!a || !b) return null;
              const target = a.number <= b.number ? a : b;
              return (
                <div
                  key={`${suggestion.aId}:${suggestion.bId}`}
                  className="min-w-0 rounded-lg border p-3"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Одна модель: <strong>{percent(suggestion.sameModel)}</strong>
                    </span>
                    <span>
                      Один тип: <strong>{percent(suggestion.sameType)}</strong>
                    </span>
                    <span className="truncate">
                      {a.categoryTitle || "Без категорії"}
                    </span>
                  </div>

                  <div className="mt-2 flex min-w-0 flex-col gap-1">
                    <div className="flex min-w-0 items-center gap-2 text-sm">
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        № {a.number}
                      </span>
                      <span className="min-w-0 truncate" title={a.title}>
                        {a.title}
                      </span>
                    </div>
                    <div className="flex min-w-0 items-center gap-2 text-sm">
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        № {b.number}
                      </span>
                      <span className="min-w-0 truncate" title={b.title}>
                        {b.title}
                      </span>
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    Після об’єднання залишиться назва групи № {target.number}.
                  </p>

                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        dismissMergeSuggestion(suggestion.aId, suggestion.bId)
                      }
                    >
                      Пропустити
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        void handleMerge(suggestion.aId, suggestion.bId)
                      }
                    >
                      <HugeiconsIcon
                        icon={GroupLayersIcon}
                        data-icon="inline-start"
                      />
                      Об’єднати
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          {visible.length > 0 ? (
            <Button variant="ghost" onClick={clearMergeSuggestions}>
              Пропустити все
            </Button>
          ) : null}
          <DialogClose render={<Button variant="outline" />}>
            Закрити
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
