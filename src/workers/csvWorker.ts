// workers/csvWorker.ts
// Vite/TanStack Start: import this via `new Worker(new URL('./csvWorker.ts', import.meta.url), { type: 'module' })`

import Papa from "papaparse";

// ─── Message Protocol ─────────────────────────────────────────────────────────

export type WorkerInMessage = {
  type: "PARSE";
  file: File;
  fileId: number;
};

export type WorkerOutMessage =
  | { type: "PROGRESS"; processed: number; total: number }
  | { type: "CHUNK"; rows: ParsedRow[]; fileId: number }
  | { type: "DONE"; totalRows: number; fileId: number }
  | { type: "ERROR"; message: string };

// Raw parsed row (all strings from Papa)
interface RawRow {
  goods_id?: string;
  goods_title?: string;
  gomer_sync_source_id?: string;
  goods_images_url?: string;
  [key: string]: string | undefined;
}

// Typed output row
export interface ParsedRow {
  goods_id: number;
  goods_title: string;
  gomer_sync_source_id: number;
  goods_images_url: string[];
  fileId: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseImagesUrl(raw: string | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  // Handle JSON array: ["url1","url2"] or ['url1','url2']
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // fallback: strip brackets and split
      return trimmed
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
    }
  }
  // Single URL
  return trimmed ? [trimmed] : [];
}

function mapRow(raw: RawRow, fileId: number): ParsedRow | null {
  const goods_id = Number(raw.goods_id);
  const gomer_sync_source_id = Number(raw.gomer_sync_source_id);

  if (!raw.goods_id || isNaN(goods_id)) return null;

  return {
    goods_id,
    goods_title: raw.goods_title ?? "",
    gomer_sync_source_id: isNaN(gomer_sync_source_id)
      ? 0
      : gomer_sync_source_id,
    goods_images_url: parseImagesUrl(raw.goods_images_url),
    fileId,
  };
}

// ─── Worker Entry ─────────────────────────────────────────────────────────────

const CHUNK_SIZE = 500; // rows per postMessage batch

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const { type, file, fileId } = event.data;

  if (type !== "PARSE") return;

  let totalRows = 0;
  let processedRows = 0;
  let buffer: ParsedRow[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const msg: WorkerOutMessage = { type: "CHUNK", rows: buffer, fileId };
    self.postMessage(msg);
    buffer = [];
  };

  Papa.parse<RawRow>(file, {
    header: true,
    skipEmptyLines: true,
    worker: false, // we're already in a worker
    // PapaParse doesn't give total upfront for streaming, use file size heuristic
    chunk(results) {
      totalRows += results.data.length;

      for (const raw of results.data) {
        const row = mapRow(raw, fileId);
        if (!row) continue;

        buffer.push(row);
        processedRows++;

        if (buffer.length >= CHUNK_SIZE) {
          flush();
          // Send progress
          const progressMsg: WorkerOutMessage = {
            type: "PROGRESS",
            processed: processedRows,
            total: totalRows,
          };
          self.postMessage(progressMsg);
        }
      }
    },
    complete() {
      flush();
      const doneMsg: WorkerOutMessage = {
        type: "DONE",
        totalRows: processedRows,
        fileId,
      };
      self.postMessage(doneMsg);
    },
    error(error) {
      const errMsg: WorkerOutMessage = {
        type: "ERROR",
        message: error.message,
      };
      self.postMessage(errMsg);
    },
  });
};
