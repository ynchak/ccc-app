"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ComputerIcon,
  Moon02Icon,
  Note02Icon,
  Sun03Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ThemeValue = "system" | "light" | "paper" | "dark";

const THEME_LABELS: Record<ThemeValue, string> = {
  system: "Системна",
  light: "Світла",
  paper: "Папір",
  dark: "Темна",
};

const LIGHT_OLD_THEMES = new Set([
  "light",
  "soft",
  "soft-sand",
  "soft-sage",
  "soft-lavender",
  "soft-mist",
  "soft-olive",
  "soft-clay",
  "soft-rose",
  "rose-pine-dawn",
]);

const DARK_OLD_THEMES = new Set([
  "dark",
  "soft-charcoal",
  "soft-graphite",
  "soft-mocha",
  "rose-pine",
]);

const subscribe = () => () => {};

/** true только после гидратации — чтобы не было рассинхрона SSR. */
function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/** Компактный выбор темы в виде иконки. */
export function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const value: ThemeValue =
    mounted &&
    (theme === "light" || theme === "paper" || theme === "dark")
      ? theme
      : "system";
  const title = `Тема: ${THEME_LABELS[value]}`;

  // Миграция со старых наборов тем.
  useEffect(() => {
    try {
      const stored = localStorage.getItem("ccc-theme");
      const rawSoft = localStorage.getItem("ccc-soft-theme");
      if (!stored && !rawSoft) return;

      let oldSoft = false;
      if (rawSoft) {
        try {
          oldSoft = Boolean(JSON.parse(rawSoft)?.state?.soft);
        } catch {
          oldSoft = false;
        }
      }

      const systemDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      let target: ThemeValue = "light";

      if (
        stored === "system" ||
        stored === "light" ||
        stored === "paper" ||
        stored === "dark"
      ) {
        target = stored;
      } else if (stored === "soft") {
        target = "light";
      } else if (stored && DARK_OLD_THEMES.has(stored)) {
        target = "dark";
      } else if (stored && LIGHT_OLD_THEMES.has(stored)) {
        target = "light";
      } else if (oldSoft) {
        target = systemDark ? "dark" : "light";
      }

      if (stored !== target) setTheme(target);
      localStorage.removeItem("ccc-soft-theme");
    } catch {
      // localStorage может быть недоступен.
    }
  }, [setTheme]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label={title}
            title={title}
          />
        }
      >
        <HugeiconsIcon
          icon={
            value === "dark"
              ? Moon02Icon
              : value === "paper"
                ? Note02Icon
                : value === "light"
                  ? Sun03Icon
                  : ComputerIcon
          }
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="min-w-52">
        <DropdownMenuGroup>
          {(["system", "light", "paper", "dark"] as const).map((themeValue) => (
            <DropdownMenuItem
              key={themeValue}
              onClick={() => setTheme(themeValue)}
            >
              <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
                {mounted && value === themeValue ? (
                  <HugeiconsIcon icon={Tick02Icon} className="size-3.5" />
                ) : null}
              </span>
              <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
                <HugeiconsIcon
                  icon={
                    themeValue === "system"
                      ? ComputerIcon
                      : themeValue === "paper"
                        ? Note02Icon
                        : themeValue === "light"
                          ? Sun03Icon
                          : Moon02Icon
                  }
                  className="size-3.5"
                />
              </span>
              {THEME_LABELS[themeValue]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
