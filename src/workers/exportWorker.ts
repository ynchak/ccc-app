// workers/exportWorker.ts
// Запускается через: new Worker(new URL('./exportWorker.ts', import.meta.url), { type: 'module' })

export type ExportFormat = "csv" | "json";

export type WorkerInMessage = {
  type: "EXPORT";
  format: ExportFormat;
  goods: ExportRow[];
  filename: string;
};

export type WorkerOutMessage =
  | { type: "PROGRESS"; pct: number }
  | { type: "DONE"; blob: Blob; filename: string }
  | { type: "ERROR"; message: string };

export interface ExportRow {
  goods_id: number;
  goods_title: string;
  gomer_sync_source_id: number;
  goods_images_url: string[];
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function escapeCSV(val: string): string {
  // RFC 4180: если значение содержит запятую, кавычку или перевод строки — оборачиваем в кавычки
  if (/[",\n\r]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
}

const CSV_HEADER = [
  "goods_id",
  "goods_title",
  "gomer_sync_source_id",
  "goods_images_url",
].join(",");

function rowToCSV(row: ExportRow): string {
  return [
    row.goods_id,
    escapeCSV(row.goods_title),
    row.gomer_sync_source_id,
    // массив URL оборачиваем в JSON-строку, затем эскейпим как CSV-поле
    escapeCSV(JSON.stringify(row.goods_images_url)),
  ].join(",");
}

function buildCSV(
  goods: ExportRow[],
  postProgress: (pct: number) => void,
): Blob {
  const CHUNK = 5000; // строк за итерацию (чтобы не замораживать воркер)
  const parts: string[] = [CSV_HEADER + "\n"];

  for (let i = 0; i < goods.length; i += CHUNK) {
    const slice = goods.slice(i, i + CHUNK);
    parts.push(slice.map(rowToCSV).join("\n") + "\n");
    postProgress(Math.round(((i + slice.length) / goods.length) * 100));
  }

  return new Blob(parts, { type: "text/csv;charset=utf-8;" });
}

// ─── JSON helpers ─────────────────────────────────────────────────────────────

function buildJSON(
  goods: ExportRow[],
  postProgress: (pct: number) => void,
): Blob {
  const CHUNK = 5000;
  const parts: string[] = ["[\n"];

  for (let i = 0; i < goods.length; i += CHUNK) {
    const slice = goods.slice(i, i + CHUNK);
    const isLast = i + CHUNK >= goods.length;

    parts.push(
      slice
        .map((row, ci) => {
          const comma = isLast && ci === slice.length - 1 ? "" : ",";
          return JSON.stringify(row) + comma;
        })
        .join("\n") + "\n",
    );

    postProgress(Math.round(((i + slice.length) / goods.length) * 100));
  }

  parts.push("]");
  return new Blob(parts, { type: "application/json;charset=utf-8;" });
}

// ─── Worker entry ─────────────────────────────────────────────────────────────

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const { type, format, goods, filename } = event.data;
  if (type !== "EXPORT") return;

  try {
    const postProgress = (pct: number) => {
      const msg: WorkerOutMessage = { type: "PROGRESS", pct };
      self.postMessage(msg);
    };

    const blob =
      format === "csv"
        ? buildCSV(goods, postProgress)
        : buildJSON(goods, postProgress);

    const ext = format === "csv" ? ".csv" : ".json";
    const outFilename =
      filename.replace(/\.[^.]+$/, "") + `_export_${Date.now()}${ext}`;

    const done: WorkerOutMessage = {
      type: "DONE",
      blob,
      filename: outFilename,
    };
    // Blob передаём как transferable — zero-copy
    self.postMessage(done, []);
  } catch (err) {
    const errMsg: WorkerOutMessage = {
      type: "ERROR",
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(errMsg);
  }
};
