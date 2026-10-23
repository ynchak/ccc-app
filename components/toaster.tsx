"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { useToastStore } from "@/lib/store/toast-store";

/** Всплывающие уведомления. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-2 rounded-lg border bg-popover px-3 py-2.5 text-sm shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${
            toast.tone === "error"
              ? "border-destructive/30"
              : toast.tone === "success"
                ? "border-emerald-500/30"
                : ""
          }`}
        >
          <HugeiconsIcon
            icon={
              toast.tone === "error"
                ? AlertCircleIcon
                : toast.tone === "success"
                  ? CheckmarkCircle02Icon
                  : InformationCircleIcon
            }
            className={`mt-0.5 size-4 shrink-0 ${
              toast.tone === "error"
                ? "text-destructive"
                : toast.tone === "success"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground"
            }`}
          />
          <p className="min-w-0 flex-1">{toast.message}</p>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => dismiss(toast.id)}
            aria-label="Закрити сповіщення"
          >
            <HugeiconsIcon icon={Cancel01Icon} />
          </Button>
        </div>
      ))}
    </div>
  );
}
