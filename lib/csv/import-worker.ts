import { groupCsvText, type GroupedCsv } from "@/lib/csv/group";
import type {
  CsvWorkerRequest,
  CsvWorkerResponse,
} from "@/lib/csv/worker-types";

/** Ошибка загрузки/запуска воркера — можно безопасно fallback-нуть. */
class WorkerUnavailableError extends Error {}

/** Разбирает и группирует CSV в отдельном потоке, если это возможно. */
export async function parseAndGroupCsv(text: string): Promise<GroupedCsv> {
  if (typeof Worker === "undefined") {
    return groupCsvText(text);
  }

  try {
    return await runWorker(text);
  } catch (error) {
    if (error instanceof WorkerUnavailableError) {
      // Например, CSP или окружение не поддерживает module workers.
      return groupCsvText(text);
    }
    throw error;
  }
}

function runWorker(text: string): Promise<GroupedCsv> {
  return new Promise<GroupedCsv>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./csv.worker.ts", import.meta.url), {
        type: "module",
        name: "ccc-csv-import",
      });
    } catch (error) {
      reject(new WorkerUnavailableError("CSV worker is unavailable", { cause: error }));
      return;
    }

    const finish = () => worker.terminate();

    worker.onmessage = (event: MessageEvent<CsvWorkerResponse>) => {
      finish();
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.error));
    };

    worker.onerror = (event) => {
      finish();
      reject(new WorkerUnavailableError(event.message || "CSV worker error"));
    };

    const request: CsvWorkerRequest = { text };
    worker.postMessage(request);
  });
}
