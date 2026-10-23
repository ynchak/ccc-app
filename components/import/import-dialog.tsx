"use client";

import { useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  FileImportIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore } from "@/lib/store/app-store";
import { notify } from "@/lib/store/toast-store";

type Stage =
  | "idle"
  | "grouping"
  | "saving"
  | "cleaning"
  | "done"
  | "error";

function Step({
  label,
  active,
  done,
  detail,
}: {
  label: string;
  active: boolean;
  done: boolean;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
        {done ? (
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            className="size-4 text-emerald-600 dark:text-emerald-400"
          />
        ) : active ? (
          <HugeiconsIcon
            icon={Loading03Icon}
            className="size-4 animate-spin text-muted-foreground"
          />
        ) : (
          <span className="size-2 rounded-full bg-muted-foreground/30" />
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={active || done ? "font-medium" : "text-muted-foreground"}>
          {label}
        </span>
        {detail ? (
          <span className="text-xs text-muted-foreground">{detail}</span>
        ) : null}
      </span>
    </div>
  );
}

/**
 * Импорт CSV: группировка по фото, сохранение и очистка названий ИИ.
 */
export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const importFile = useAppStore((s) => s.importFile);
  const cleanTitlesWithLlm = useAppStore((s) => s.cleanTitlesWithLlm);
  const [stage, setStageState] = useState<Stage>("idle");
  const stageRef = useRef<Stage>("idle");
  const setStage = (next: Stage) => {
    stageRef.current = next;
    setStageState(next);
  };
  const [error, setError] = useState<string | null>(null);
  const [fileSaved, setFileSaved] = useState(false);
  const [cleanupProgress, setCleanupProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy =
    stage === "grouping" || stage === "saving" || stage === "cleaning";

  const reset = () => {
    setStage("idle");
    setError(null);
    setFileSaved(false);
    setCleanupProgress(null);
    setIsDragging(false);
  };

  const handleFile = async (file: File) => {
    if (busy) return;
    setError(null);
    setFileSaved(false);
    setCleanupProgress(null);
    setStage("grouping");

    try {
      const content = await file.text();
      if (!content.trim()) {
        throw new Error("Файл пустой — нет данных для группировки.");
      }

      await importFile(file.name, content, (nextStage) => {
        setStage(nextStage);
      });
      setFileSaved(true);
      setStage("cleaning");

      const result = await cleanTitlesWithLlm((done, total) => {
        setCleanupProgress({ done, total });
      });
      setStage("done");

      if (result.skipped) {
        notify(
          "Файл загружен. LLM не настроена — названия оставлены как есть.",
          "error",
        );
      } else if (result.failed > 0) {
        notify(
          `Файл загружен. Очищено названий: ${result.cleaned} из ${result.total}.`,
          "error",
        );
      } else {
        notify(
          `Названия очищены: ${result.cleaned} из ${result.total}${
            result.merged > 0 ? `, объединено групп: ${result.merged}` : ""
          }.`,
          "success",
        );
      }

      onOpenChange(false);
    } catch (caught) {
      const message =
        caught instanceof Error && caught.message
          ? caught.message
          : "Не удалось обработать файл";

      // Если файл уже сохранён, не предлагаем выбирать его заново.
      if (fileSaved) {
        notify(
          `Файл загружен, но названия не очищены: ${message}`,
          "error",
        );
        onOpenChange(false);
        return;
      }

      setStage("error");
      setError(message);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        const isWorking =
          stageRef.current === "grouping" ||
          stageRef.current === "saving" ||
          stageRef.current === "cleaning";
        if (!next && isWorking) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Загрузка CSV</DialogTitle>
          <DialogDescription>
            Выберите файл — товары сгруппируются по фото, затем ИИ очистит
            названия групп.
          </DialogDescription>
        </DialogHeader>

        {stage === "idle" || stage === "error" ? (
          <>
            <div
              role="button"
              tabIndex={0}
              aria-label="Выбрать CSV-файл"
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                const file = event.dataTransfer.files[0];
                if (file) void handleFile(file);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ${
                isDragging
                  ? "border-primary bg-accent"
                  : "border-border hover:border-foreground/30 hover:bg-muted/40"
              }`}
            >
              <HugeiconsIcon
                icon={FileImportIcon}
                strokeWidth={1.5}
                className="size-8 text-muted-foreground"
              />
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm font-medium">Перетащите CSV сюда</p>
                <p className="text-xs text-muted-foreground">
                  или нажмите, чтобы выбрать файл из папки
                </p>
              </div>
              <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium">
                <HugeiconsIcon icon={FileImportIcon} className="size-4" />
                Выбрать файл
              </span>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                  event.target.value = "";
                }}
              />
            </div>

            {error ? (
              <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <span>{error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={reset}
                >
                  Попробовать снова
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border p-5">
            <Step
              label="Группировка по фото"
              active={stage === "grouping"}
              done={stage === "saving" || stage === "cleaning" || stage === "done"}
            />
            <Step
              label="Сохранение файла"
              active={stage === "saving"}
              done={stage === "cleaning" || stage === "done"}
            />
            <Step
              label="Очистка названий"
              active={stage === "cleaning"}
              done={stage === "done"}
              detail={
                cleanupProgress
                  ? `Обработано ${cleanupProgress.done} из ${cleanupProgress.total}`
                  : undefined
              }
            />
            <p className="pt-1 text-xs text-muted-foreground">
              Не закрывайте окно, пока идёт обработка.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
