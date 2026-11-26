"use client";

import { useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
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
import { useCategoryStore } from "@/lib/store/category-store";
import { notify } from "@/lib/store/toast-store";

type Stage = "idle" | "parsing" | "saving" | "error";

/** Загрузка CSV в поток разнесения по категориям. */
export function CategoryImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const importFile = useCategoryStore((state) => state.importFile);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = stage === "parsing" || stage === "saving";

  const reset = () => {
    setStage("idle");
    setError(null);
    setFileName("");
    setIsDragging(false);
  };

  const handleFile = async (file: File) => {
    if (busy) return;
    setError(null);
    setFileName(file.name);
    setStage("parsing");

    try {
      const content = await file.text();
      if (!content.trim()) {
        throw new Error("Файл порожній — немає даних для розбору.");
      }
      const result = await importFile(file.name, content, (nextStage) => {
        setStage(nextStage);
      });
      notify(
        `Файл завантажено: ${result.clusterCount} кластерів.`,
        "success",
      );
      reset();
      onOpenChange(false);
    } catch (caught) {
      setStage("error");
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "Не вдалося обробити файл",
      );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Завантаження для категорій</DialogTitle>
          <DialogDescription>
            Товари згрупуються за фото без урахування категорій. LLM на цьому
            етапі не використовується.
          </DialogDescription>
        </DialogHeader>

        {busy ? (
          <div className="flex flex-col gap-2 rounded-xl border p-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <HugeiconsIcon
                icon={Loading03Icon}
                className="size-4 animate-spin text-muted-foreground"
              />
              {stage === "parsing"
                ? "Розбір і кластеризація"
                : "Збереження файлу"}
            </div>
            <p className="truncate text-xs text-muted-foreground">{fileName}</p>
            <p className="text-xs text-muted-foreground">
              Не закривайте вікно, поки триває обробка.
            </p>
          </div>
        ) : (
          <>
            <div
              role="button"
              tabIndex={0}
              aria-label="Вибрати CSV-файл"
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
                <p className="text-sm font-medium">Перетягніть CSV сюди</p>
                <p className="text-xs text-muted-foreground">
                  або натисніть, щоб вибрати файл
                </p>
              </div>
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
                  Спробувати знову
                </Button>
              </div>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
