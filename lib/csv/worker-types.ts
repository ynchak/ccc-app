import type { ParsedCategoryCsv } from "@/lib/csv/category";
import type { GroupedCsv } from "@/lib/csv/group";

/** Запрос к CSV-воркеру. */
export interface CsvWorkerRequest {
  text: string;
  mode?: "grouping" | "categories";
}

/** Результат в зависимости от режима. */
export type CsvWorkerResult = GroupedCsv | ParsedCategoryCsv;

/** Ответ CSV-воркера. */
export type CsvWorkerResponse =
  | { ok: true; result: CsvWorkerResult }
  | { ok: false; error: string };
