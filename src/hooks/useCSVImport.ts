// hooks/useCSVImport.ts
import { useCallback, useRef, useState } from "react";
import { csvFileRepo, goodsRepo } from "@/db/db";
import type { WorkerOutMessage, ParsedRow } from "@/workers/csvWorker";

export type ImportStatus = "idle" | "parsing" | "saving" | "done" | "error";

export interface ImportState {
  status: ImportStatus;
  progress: number; // 0–100
  processedRows: number;
  error: string | null;
}

const initialState: ImportState = {
  status: "idle",
  progress: 0,
  processedRows: 0,
  error: null,
};

/**
 * useCSVImport
 *
 * Orchestrates:
 *  1. Creating a CsvFile record in IndexedDB
 *  2. Spawning a Web Worker to parse the CSV
 *  3. Writing chunks to GoodsRepository as they arrive
 *  4. Tracking progress
 */
export function useCSVImport(onSuccess?: (fileId: number) => void) {
  const [state, setState] = useState<ImportState>(initialState);
  const workerRef = useRef<Worker | null>(null);
  // Buffer incoming chunks so we can bulk-insert in background
  const pendingChunks = useRef<ParsedRow[][]>([]);
  const isSaving = useRef(false);

  const drainChunks = useCallback(async () => {
    if (isSaving.current) return;
    isSaving.current = true;

    while (pendingChunks.current.length > 0) {
      const chunk = pendingChunks.current.shift()!;
      await goodsRepo.bulkInsert(chunk);
    }

    isSaving.current = false;
  }, []);

  const importFile = useCallback(
    async (file: File) => {
      // Reset
      setState({ ...initialState, status: "parsing" });
      pendingChunks.current = [];
      isSaving.current = false;

      // 1. Create CsvFile record (get its id for FK)
      const fileId = await csvFileRepo.create({
        name: file.name,
        size: file.size,
        importedAt: new Date(),
        totalRows: 0, // updated on DONE
      });

      // 2. Spawn worker
      const worker = new Worker(
        new URL("../workers/csvWorker.ts", import.meta.url),
        { type: "module" },
      );
      workerRef.current = worker;

      worker.onmessage = async (event: MessageEvent<WorkerOutMessage>) => {
        const msg = event.data;

        switch (msg.type) {
          case "PROGRESS": {
            const progress =
              msg.total > 0 ? Math.round((msg.processed / msg.total) * 100) : 0;
            setState((prev) => ({
              ...prev,
              progress,
              processedRows: msg.processed,
            }));
            break;
          }

          case "CHUNK": {
            pendingChunks.current.push(msg.rows);
            // drain without blocking the worker message loop
            drainChunks();
            break;
          }

          case "DONE": {
            setState((prev) => ({ ...prev, status: "saving", progress: 99 }));

            // Wait for all pending saves to finish
            await new Promise<void>((resolve) => {
              const interval = setInterval(() => {
                if (pendingChunks.current.length === 0 && !isSaving.current) {
                  clearInterval(interval);
                  resolve();
                }
              }, 100);
            });

            // Update total row count on the file record
            await csvFileRepo.update(fileId, { totalRows: msg.totalRows });

            setState({
              status: "done",
              progress: 100,
              processedRows: msg.totalRows,
              error: null,
            });

            worker.terminate();
            workerRef.current = null;
            onSuccess?.(fileId);
            break;
          }

          case "ERROR": {
            // Roll back: remove broken file + its goods
            await csvFileRepo.remove(fileId);
            setState({
              status: "error",
              progress: 0,
              processedRows: 0,
              error: msg.message,
            });
            worker.terminate();
            workerRef.current = null;
            break;
          }
        }
      };

      worker.onerror = (err) => {
        setState({
          status: "error",
          progress: 0,
          processedRows: 0,
          error: err.message,
        });
        worker.terminate();
        workerRef.current = null;
      };

      // 3. Kick off parsing
      worker.postMessage({ type: "PARSE", file, fileId });
    },
    [drainChunks, onSuccess],
  );

  const cancel = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setState(initialState);
  }, []);

  return { state, importFile, cancel };
}
