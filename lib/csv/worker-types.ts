import type { GroupedCsv } from "@/lib/csv/group";

/** Запрос к CSV-воркеру. */
export interface CsvWorkerRequest {
  text: string;
}

/** Ответ CSV-воркера. */
export type CsvWorkerResponse =
  | { ok: true; result: GroupedCsv }
  | { ok: false; error: string };
