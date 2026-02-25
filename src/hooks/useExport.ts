// hooks/useExport.ts
import { useCallback, useRef, useState } from "react";
// import { goodsRepo } from "@/db/db";
import type {
  ExportFormat,
  WorkerOutMessage,
  ExportRow,
} from "@/workers/exportWorker";

export type ExportStatus = "idle" | "loading" | "exporting" | "done" | "error";

export interface ExportState {
  status: ExportStatus;
  progress: number; // 0–100
  error: string | null;
}

const BATCH = 5000; // строк за один запрос к IndexedDB при загрузке

/**
 * useExport
 *
 * Последовательность:
 *  1. "loading"  — читаем выбранные товары из IndexedDB батчами
 *  2. "exporting" — передаём в exportWorker, получаем прогресс
 *  3. "done"     — тригерим скачивание через временный <a>
 */
export function useExport() {
  const [state, setState] = useState<ExportState>({
    status: "idle",
    progress: 0,
    error: null,
  });
  const workerRef = useRef<Worker | null>(null);

  const startExport = useCallback(
    async (
      fileId: number,
      filename: string,
      selectedIds: Set<number>,
      format: ExportFormat,
    ) => {
      if (state.status === "loading" || state.status === "exporting") return;

      setState({ status: "loading", progress: 0, error: null });

      try {
        // ── 1. Загружаем выбранные товары из IndexedDB ──────────────────────
        // getByFileId возвращает все; фильтруем на клиенте.
        // Для очень больших файлов это нормально — мы уже в памяти.
        // Альтернатива — добавить метод репозитория с whereIn (Dexie не поддерживает
        // WHERE IN нативно, поэтому batch-anyOf — лучшее что есть).
        const selectedArr = Array.from(selectedIds);
        const rows: ExportRow[] = [];

        // Dexie anyOf работает по индексированному полю goods_id
        const PAGE = BATCH;
        for (let i = 0; i < selectedArr.length; i += PAGE) {
          const batch = selectedArr.slice(i, i + PAGE);
          const found = await (
            await import("@/db/db")
          ).db.goods
            .where("goods_id")
            .anyOf(batch)
            .and((g) => g.fileId === fileId)
            .toArray();
          rows.push(
            ...found.map((g) => ({
              goods_id: g.goods_id,
              goods_title: g.goods_title,
              gomer_sync_source_id: g.gomer_sync_source_id,
              goods_images_url: g.goods_images_url,
            })),
          );
          setState((prev) => ({
            ...prev,
            progress: Math.round(
              ((i + batch.length) / selectedArr.length) * 50,
            ),
          }));
        }

        setState((prev) => ({ ...prev, status: "exporting", progress: 50 }));

        // ── 2. Запускаем воркер ──────────────────────────────────────────────
        const worker = new Worker(
          new URL("../workers/exportWorker.ts", import.meta.url),
          { type: "module" },
        );
        workerRef.current = worker;

        worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
          const msg = event.data;

          switch (msg.type) {
            case "PROGRESS":
              // Воркер занимает вторую половину прогресса (50–100)
              setState((prev) => ({
                ...prev,
                progress: 50 + Math.round(msg.pct / 2),
              }));
              break;

            case "DONE": {
              // ── 3. Скачивание ──────────────────────────────────────────────
              const url = URL.createObjectURL(msg.blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = msg.filename;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              // Освобождаем Object URL через небольшую задержку
              setTimeout(() => URL.revokeObjectURL(url), 5000);

              setState({ status: "done", progress: 100, error: null });
              worker.terminate();
              workerRef.current = null;

              // Автосброс в idle через 2 сек
              setTimeout(() => {
                setState({ status: "idle", progress: 0, error: null });
              }, 2000);
              break;
            }

            case "ERROR":
              setState({ status: "error", progress: 0, error: msg.message });
              worker.terminate();
              workerRef.current = null;
              break;
          }
        };

        worker.onerror = (err) => {
          setState({ status: "error", progress: 0, error: err.message });
          worker.terminate();
          workerRef.current = null;
        };

        worker.postMessage({ type: "EXPORT", format, goods: rows, filename });
      } catch (err) {
        setState({
          status: "error",
          progress: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [state.status],
  );

  const cancel = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setState({ status: "idle", progress: 0, error: null });
  }, []);

  return { state, startExport, cancel };
}
