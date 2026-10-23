"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, LockKeyIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Форма входа по общему паролю. */
export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);

    const rawNext = new URLSearchParams(window.location.search).get("next");
    const next =
      rawNext &&
      rawNext.startsWith("/") &&
      !rawNext.startsWith("//") &&
      !rawNext.startsWith("/api/")
        ? rawNext
        : "/";

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, next }),
      });

      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data && typeof data === "object" && "error" in data
            ? String((data as { error?: unknown }).error)
            : "Не удалось войти";
        setError(message || "Не удалось войти");
        return;
      }

      const redirectTo =
        data && typeof data === "object" && "next" in data
          ? String((data as { next?: unknown }).next)
          : next;
      router.replace(redirectTo || "/");
      router.refresh();
    } catch {
      setError("Нет связи с сервером. Попробуйте ещё раз.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Вход в приложение</h2>
        <p className="text-sm text-muted-foreground">
          Введите пароль, который вам передали.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="app-password">Пароль</Label>
        <div className="relative">
          <HugeiconsIcon
            icon={LockKeyIcon}
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="app-password"
            type="password"
            value={password}
            autoFocus
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            className="pl-8"
            aria-invalid={error !== null}
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={!password || isSubmitting}>
        {isSubmitting ? "Проверяем…" : "Войти"}
        <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
      </Button>
    </form>
  );
}
