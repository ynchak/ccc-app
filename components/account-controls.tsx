"use client";

import { ThemeSelect } from "@/components/theme-select";
import { LogoutButton } from "@/components/auth/logout-button";

/** Одинаковые настройки аккаунта и темы для сайдбаров обоих флоу. */
export function AccountControls({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-lg border bg-muted/20 p-2 ${className ?? ""}`}
    >
      <p className="mb-2 px-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        Налаштування
      </p>
      <div className="grid grid-cols-2 gap-2">
        <ThemeSelect showLabel />
        <LogoutButton showLabel />
      </div>
    </div>
  );
}
