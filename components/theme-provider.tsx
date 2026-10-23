"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Светлая и тёмная темы + системная. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      themes={["light", "paper", "dark"]}
      defaultTheme="system"
      enableSystem
      enableColorScheme={false}
      storageKey="ccc-theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
