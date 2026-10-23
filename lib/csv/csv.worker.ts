import { groupCsvText } from "@/lib/csv/group";
import type {
  CsvWorkerRequest,
  CsvWorkerResponse,
} from "@/lib/csv/worker-types";

/**
 * Воркер для тяжёлого разбора CSV и фото-группировки, чтобы не блокировать
 * основной поток при загрузке больших файлов.
 */
const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<CsvWorkerRequest>) => void) | null;
  postMessage: (message: CsvWorkerResponse) => void;
};

workerScope.onmessage = (event) => {
  let response: CsvWorkerResponse;
  try {
    response = { ok: true, result: groupCsvText(event.data.text) };
  } catch (error) {
    response = {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Не удалось разобрать CSV-файл",
    };
  }
  workerScope.postMessage(response);
};

export {};
