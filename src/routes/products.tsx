// routes/products.tsx  (TanStack Start page)
import { createFileRoute } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useLiveQuery } from "dexie-react-hooks";
import { csvFileRepo, goodsRepo, type Good } from "@/db/db";
import { useCSVImport } from "@/hooks/useCSVImport";
import { useExport } from "@/hooks/useExport";
import { useSelection } from "@/hooks/useSelection";
import type { ExportFormat } from "@/workers/exportWorker";

export const Route = createFileRoute("/products")({
  component: ProductsPage,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const CARD_MIN_W = 210;
const CARD_H = 290;
const GAP = 12;
const PAGE_SIZE = 200;
const scrollKey = (fileId: number) => `scroll_pos_file_${fileId}`;

type SelectionSet = Set<number>;

// ─── ProgressBar ─────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${value}%` }} />
    </div>
  );
}

// ─── ExportMenu ───────────────────────────────────────────────────────────────
// Кнопка «Экспорт» с дропдауном CSV / JSON.
// Показывает инлайн-прогресс во время экспорта.

interface ExportMenuProps {
  count: number;
  onExport: (format: ExportFormat) => void;
  status: "idle" | "loading" | "exporting" | "done" | "error";
  progress: number;
  error: string | null;
  onCancel: () => void;
}

function ExportMenu({
  count,
  onExport,
  status,
  progress,
  error,
  onCancel,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Закрываем дропдаун при клике вне
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isBusy = status === "loading" || status === "exporting";

  if (isBusy) {
    return (
      <div className="export-busy">
        <span className="export-busy-label">
          {status === "loading" ? "Загрузка…" : "Экспорт…"}
        </span>
        <div className="export-busy-bar">
          <div className="export-busy-fill" style={{ width: `${progress}%` }} />
        </div>
        <button className="sel-btn sel-btn--danger" onClick={onCancel}>
          ✕
        </button>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="export-done">
        <svg viewBox="0 0 16 16" fill="none" className="export-done-icon">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M5 8l2.5 2.5L11 5.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Скачивание началось
      </div>
    );
  }

  return (
    <div ref={ref} className="export-wrap">
      <button
        className="sel-btn sel-btn--accent"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg viewBox="0 0 14 14" fill="none" className="export-icon">
          <path
            d="M7 1v8M4 6l3 3 3-3M2 10v2a1 1 0 001 1h8a1 1 0 001-1v-2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Экспорт {count.toLocaleString()}
        <svg
          viewBox="0 0 8 5"
          fill="none"
          className={`export-chevron${open ? " open" : ""}`}
        >
          <path
            d="M1 1l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="export-dropdown">
          <button
            className="export-opt"
            onClick={() => {
              onExport("csv");
              setOpen(false);
            }}
          >
            <span className="export-opt-badge">CSV</span>
            <span className="export-opt-desc">таблица, совместима с Excel</span>
          </button>
          <button
            className="export-opt"
            onClick={() => {
              onExport("json");
              setOpen(false);
            }}
          >
            <span className="export-opt-badge">JSON</span>
            <span className="export-opt-desc">массив объектов</span>
          </button>
        </div>
      )}

      {status === "error" && error && (
        <span className="export-error">{error}</span>
      )}
    </div>
  );
}

// ─── SelectionBar ─────────────────────────────────────────────────────────────

interface SelectionBarProps {
  count: number;
  total: number;
  onSelectAll: () => void;
  onClear: () => void;
  onExport: (format: ExportFormat) => void;
  exportStatus: "idle" | "loading" | "exporting" | "done" | "error";
  exportProgress: number;
  exportError: string | null;
  onExportCancel: () => void;
}

function SelectionBar({
  count,
  total,
  onSelectAll,
  onClear,
  onExport,
  exportStatus,
  exportProgress,
  exportError,
  onExportCancel,
}: SelectionBarProps) {
  if (count === 0) return null;

  return (
    <div className="sel-bar">
      <span className="sel-count">
        <span className="sel-num">{count.toLocaleString()}</span> выбрано
      </span>

      <div className="sel-divider" />

      <div className="sel-actions">
        {count < total && (
          <button className="sel-btn" onClick={onSelectAll}>
            Все {total.toLocaleString()}
          </button>
        )}

        <ExportMenu
          count={count}
          onExport={onExport}
          status={exportStatus}
          progress={exportProgress}
          error={exportError}
          onCancel={onExportCancel}
        />

        <button
          className="sel-btn sel-btn--danger"
          onClick={onClear}
          title="Снять выбор"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── GoodCard ─────────────────────────────────────────────────────────────────

interface GoodCardProps {
  good: Good;
  selected: boolean;
  onSelect: (goodsId: number, idx: number, shiftKey: boolean) => void;
  idx: number;
}

function GoodCard({ good, selected, onSelect, idx }: GoodCardProps) {
  const firstImage = good.goods_images_url?.[0];

  const handleOpenInNewTab = (e) => {
    e.stopPropagation(); // Важно: чтобы карточка не выделилась при клике на кнопку
    // Предположим, у вас есть URL товара или ID для формирования ссылки
    const url = `https://gomer.rozetka.company/gomer/items/source/${good.gomer_sync_source_id}?ItemSearch[id]=${good.goods_id}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };
  const handleClick = useCallback(
    (e: React.MouseEvent) => onSelect(good.goods_id, idx, e.shiftKey),
    [good.goods_id, idx, onSelect],
  );

  return (
    <article
      className={`good-card${selected ? " good-card--selected" : ""}`}
      onClick={handleClick}
    >
      <div className={`card-check${selected ? " card-check--on" : ""}`}>
        {selected && (
          <svg viewBox="0 0 10 8" fill="none">
            <path
              d="M1 4l3 3 5-6"
              stroke="#000"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      <div className="card-img">
        {firstImage ? (
          <img src={firstImage} alt={good.goods_title} loading="lazy" />
        ) : (
          <span className="no-img">NO IMG</span>
        )}
        {good.goods_images_url.length > 1 && (
          <span className="img-count">+{good.goods_images_url.length}</span>
        )}
      </div>
      <div className="card-body">
        <p className="card-title">{good.goods_title || "—"}</p>
        <dl className="card-meta">
          <dt>ID</dt>
          <dd>{good.goods_id}</dd>
          <dt>Source</dt>
          <dd>{good.gomer_sync_source_id}</dd>
        </dl>
        <div className="card-actions">
          <button
            className="open-btn"
            onClick={handleOpenInNewTab}
            title="Открыть в новой вкладке"
          >
            🔗 Открыть
          </button>
        </div>
      </div>
    </article>
  );
}

// ─── VirtualizedGrid ──────────────────────────────────────────────────────────

interface VirtualizedGridProps {
  fileId: number;
  total: number;
  selection: SelectionSet;
  onSelectionChange: (next: SelectionSet) => void;
}

function VirtualizedGrid({
  fileId,
  total,
  selection,
  onSelectionChange,
}: VirtualizedGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);
  const [goods, setGoods] = useState<(Good | undefined)[]>([]);
  const [loading, setLoading] = useState(false);
  const loadedPages = useRef<Set<number>>(new Set());
  const lastAnchorIdx = useRef<number>(-1);
  const goodsRef = useRef<(Good | undefined)[]>([]);
  goodsRef.current = goods;

  // Колонки
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    const calc = (w: number) =>
      Math.max(1, Math.floor((w + GAP) / (CARD_MIN_W + GAP)));
    setCols(calc(scrollRef.current.clientWidth));
    const ro = new ResizeObserver(([e]) => setCols(calc(e.contentRect.width)));
    ro.observe(scrollRef.current);
    return () => ro.disconnect();
  }, []);

  // Загрузка страниц
  const loadPage = useCallback(
    async (page: number) => {
      if (loadedPages.current.has(page)) return;
      loadedPages.current.add(page);
      setLoading(true);
      try {
        const rows = await goodsRepo.getByFileIdPaginated(
          fileId,
          page,
          PAGE_SIZE,
        );
        setGoods((prev) => {
          const next = [...prev];
          rows.forEach((r, i) => {
            next[page * PAGE_SIZE + i] = r;
          });
          return next;
        });
      } finally {
        setLoading(false);
      }
    },
    [fileId],
  );

  useEffect(() => {
    loadPage(0);
  }, [loadPage]);

  // Restore scroll
  const scrollRestored = useRef(false);
  useEffect(() => {
    if (scrollRestored.current || !scrollRef.current) return;
    const saved = sessionStorage.getItem(scrollKey(fileId));
    if (!saved) return;
    const pos = Number(saved);
    if (!pos) return;
    const raf = requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = pos;
      scrollRestored.current = true;
    });
    return () => cancelAnimationFrame(raf);
  }, [fileId]);

  // Persist scroll (debounced)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleScroll = useCallback(() => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      if (scrollRef.current)
        sessionStorage.setItem(
          scrollKey(fileId),
          String(scrollRef.current.scrollTop),
        );
    }, 150);
  }, [fileId]);

  // Выбор / Shift-выбор
  const handleSelect = useCallback(
    (goodsId: number, idx: number, shiftKey: boolean) => {
      const current = goodsRef.current;
      if (shiftKey && lastAnchorIdx.current >= 0) {
        const lo = Math.min(lastAnchorIdx.current, idx);
        const hi = Math.max(lastAnchorIdx.current, idx);
        const next = new Set(selection);
        for (let i = lo; i <= hi; i++) {
          const g = current[i];
          if (g) next.add(g.goods_id);
        }
        onSelectionChange(next);
      } else {
        const next = new Set(selection);
        next.has(goodsId) ? next.delete(goodsId) : next.add(goodsId);
        onSelectionChange(next);
        lastAnchorIdx.current = idx;
      }
    },
    [selection, onSelectionChange],
  );

  // Virtualizer
  const rowCount = Math.ceil(total / cols);
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CARD_H,
    gap: GAP,
    overscan: 4,
    onChange(instance) {
      const endRow = instance.range?.endIndex ?? 0;
      const lastItemIndex = Math.min((endRow + 6) * cols, total - 1);
      const neededPage = Math.floor(lastItemIndex / PAGE_SIZE);
      for (let p = 0; p <= neededPage; p++) {
        if (!loadedPages.current.has(p)) loadPage(p);
      }
    },
  });

  return (
    <div ref={scrollRef} className="vgrid-scroll" onScroll={handleScroll}>
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((vrow) => {
          const startIdx = vrow.index * cols;
          const rowItems = Array.from({ length: cols }, (_, ci) => ({
            good: goods[startIdx + ci],
            flatIdx: startIdx + ci,
          }));

          return (
            <div
              key={vrow.key}
              data-index={vrow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${vrow.start}px)`,
                display: "grid",
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: GAP,
              }}
            >
              {rowItems.map(({ good, flatIdx }) =>
                good ? (
                  <GoodCard
                    key={good.id}
                    good={good}
                    idx={flatIdx}
                    selected={selection.has(good.goods_id)}
                    onSelect={handleSelect}
                  />
                ) : (
                  <div
                    key={`sk-${vrow.index}-${flatIdx}`}
                    className="card-skeleton"
                  />
                ),
              )}
            </div>
          );
        })}
      </div>

      {loading && (
        <div className="vgrid-loader">
          <span className="spinner" />
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function ProductsPage() {
  const {
    activeFileId,
    selection,
    setActiveFileId,
    setSelection,
    clearSelection,
    clearAll,
  } = useSelection();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const files = useLiveQuery(() => csvFileRepo.getAll(), []);

  const {
    state: importState,
    importFile,
    cancel: cancelImport,
  } = useCSVImport(
    useCallback(
      (fileId: number) => {
        setActiveFileId(fileId); // хук сам подгрузит пустой selection для нового файла
      },
      [setActiveFileId],
    ),
  );

  const { state: exportState, startExport, cancel: cancelExport } = useExport();

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file?.name.endsWith(".csv")) importFile(file);
    },
    [importFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) importFile(file);
    },
    [importFile],
  );

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: number) => {
      e.stopPropagation();
      await csvFileRepo.remove(id);
      clearAll(id); // убирает из localStorage и сбрасывает стейт если это активный файл
    },
    [clearAll],
  );

  const handleFileSwitch = useCallback(
    (id: number) => {
      setActiveFileId(id); // хук восстановит сохранённый selection для этого файла
    },
    [setActiveFileId],
  );

  const handleSelectAll = useCallback(async () => {
    if (!activeFileId) return;
    const all = await goodsRepo.getByFileId(activeFileId);
    setSelection(new Set(all.map((g) => g.goods_id)));
  }, [activeFileId]);

  const handleExport = useCallback(
    (format: ExportFormat) => {
      if (!activeFileId || selection.size === 0) return;
      const activeFile = files?.find((f) => f.id === activeFileId);
      startExport(
        activeFileId,
        activeFile?.name ?? "export",
        selection,
        format,
      );
    },
    [activeFileId, selection, files, startExport],
  );

  const activeFile = files?.find((f) => f.id === activeFileId);
  const isImporting =
    importState.status === "parsing" || importState.status === "saving";

  return (
    <>
      <style>{CSS}</style>
      <div className="layout">
        {/* ── Sidebar ──────────────────────────────────────────── */}
        <aside className="sidebar">
          <header className="sidebar-header">
            <span className="sidebar-title">КАТАЛОГИ</span>
            <button
              className="btn-upload"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              title="Загрузить CSV"
            >
              +
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              hidden
              onChange={handleFileInput}
            />
          </header>

          <div
            className={`drop-zone${isImporting ? " drop-zone--disabled" : ""}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => !isImporting && fileInputRef.current?.click()}
          >
            {isImporting ? (
              <div className="import-progress">
                <span className="import-label">
                  {importState.status === "parsing"
                    ? "Парсинг…"
                    : "Сохранение…"}
                </span>
                <ProgressBar value={importState.progress} />
                <span className="import-rows">
                  {importState.processedRows.toLocaleString()} строк
                </span>
                <button
                  className="btn-cancel"
                  onClick={(e) => {
                    e.stopPropagation();
                    cancelImport();
                  }}
                >
                  Отменить
                </button>
              </div>
            ) : (
              <span className="drop-hint">Перетащи CSV или нажми&nbsp;+</span>
            )}
          </div>

          {importState.status === "error" && (
            <p className="import-error">{importState.error}</p>
          )}

          <nav className="file-list">
            {files?.length === 0 && <p className="empty-files">Файлов нет</p>}
            {files?.map((f) => (
              <button
                key={f.id}
                className={`file-item${activeFileId === f.id ? " file-item--active" : ""}`}
                onClick={() => handleFileSwitch(f.id!)}
              >
                <div className="file-info">
                  <span className="file-name">{f.name}</span>
                  <span className="file-meta">
                    {f.totalRows.toLocaleString()} товаров ·{" "}
                    {formatBytes(f.size)}
                  </span>
                </div>
                <span
                  className="file-delete"
                  role="button"
                  title="Удалить"
                  onClick={(e) => handleDelete(e as any, f.id!)}
                >
                  ×
                </span>
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Content ──────────────────────────────────────────── */}
        <main className="content">
          {activeFile && activeFileId ? (
            <>
              <div className="content-header">
                <div className="content-header-row">
                  <h1 className="content-title">{activeFile.name}</h1>
                  {selection.size > 0 && (
                    <span className="header-sel-badge">
                      {selection.size.toLocaleString()} выбрано
                    </span>
                  )}
                </div>
                <span className="content-sub">
                  {activeFile.totalRows.toLocaleString()} товаров ·{" "}
                  {new Date(activeFile.importedAt).toLocaleDateString("ru")}
                  <span className="content-hint">
                    {" "}
                    · Shift+клик для диапазона
                  </span>
                </span>
              </div>

              <VirtualizedGrid
                key={activeFileId}
                fileId={activeFileId}
                total={activeFile.totalRows}
                selection={selection}
                onSelectionChange={setSelection}
              />

              <SelectionBar
                count={selection.size}
                total={activeFile.totalRows}
                onSelectAll={handleSelectAll}
                onClear={clearSelection}
                onExport={handleExport}
                exportStatus={exportState.status}
                exportProgress={exportState.progress}
                exportError={exportState.error}
                onExportCancel={cancelExport}
              />
            </>
          ) : (
            <div className="empty-state">
              <p>Выберите каталог из списка</p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    /* ── Fluent Design 2 / Copilot palette ── */
    --bg:          #f3f3f3;
    --bg-content:  #ffffff;
    --surface:     rgba(255,255,255,0.72);
    --surface2:    rgba(0,0,0,0.04);
    --surface3:    rgba(0,0,0,0.06);
    --border:      rgba(0,0,0,0.08);
    --border-med:  rgba(0,0,0,0.14);

    /* Copilot blue */
    --accent:      #0078d4;
    --accent-dark: #005fa3;
    --accent-dim:  rgba(0,120,212,0.08);
    --accent-sel:  rgba(0,120,212,0.10);
    --accent-text: #0078d4;

    --text:        #1a1a1a;
    --text-dim:    #616161;
    --text-muted:  #a0a0a0;
    --danger:      #c42b1c;
    --danger-dim:  rgba(196,43,28,0.08);
    --green:       #0e7a0d;
    --green-dim:   rgba(14,122,13,0.10);

    --radius-sm:   4px;
    --radius:      8px;
    --radius-lg:   12px;
    --radius-xl:   20px;

    --shadow-sm:   0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
    --shadow-md:   0 4px 12px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06);
    --shadow-lg:   0 8px 28px rgba(0,0,0,0.14), 0 4px 8px rgba(0,0,0,0.06);
    --shadow-fly:  0 16px 40px rgba(0,0,0,0.16), 0 4px 12px rgba(0,0,0,0.08);

    --sans:        'Segoe UI', system-ui, -apple-system, sans-serif;
    --mono:        'Cascadia Code', 'Consolas', ui-monospace, monospace;
    --sidebar-w:   280px;

    /* Acrylic blur for sidebar */
    --sidebar-bg:  rgba(243,243,243,0.80);
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--sans);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  .layout {
    display: grid;
    grid-template-columns: var(--sidebar-w) 1fr;
    height: 100vh;
    overflow: hidden;
  }

  /* ══════════════════════════════════════════
     SIDEBAR — Acrylic / Mica material
  ══════════════════════════════════════════ */
  .sidebar {
    background: var(--sidebar-bg);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 16px 14px;
    flex-shrink: 0;
  }

  .sidebar-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  /* Copilot-style round button */
  .btn-upload {
    width: 28px; height: 28px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: var(--radius);
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s, box-shadow 0.15s;
    font-weight: 300;
    box-shadow: var(--shadow-sm);
  }
  .btn-upload:disabled { opacity: 0.38; cursor: not-allowed; box-shadow: none; }
  .btn-upload:hover:not(:disabled) { background: var(--accent-dark); box-shadow: var(--shadow-md); }
  .btn-upload:active:not(:disabled) { transform: scale(0.95); }

  /* Drop zone */
  .drop-zone {
    margin: 8px 12px;
    border: 1.5px dashed var(--border-med);
    border-radius: var(--radius);
    padding: 14px 12px;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    flex-shrink: 0;
    background: transparent;
  }
  .drop-zone:hover:not(.drop-zone--disabled) {
    border-color: var(--accent);
    background: var(--accent-dim);
  }
  .drop-zone--disabled { cursor: default; }
  .drop-hint { font-size: 12px; color: var(--text-muted); }

  /* Import progress */
  .import-progress { display: flex; flex-direction: column; gap: 8px; }
  .import-label { font-size: 12px; font-weight: 600; color: var(--accent); }
  .import-rows  { font-size: 11px; color: var(--text-dim); font-variant-numeric: tabular-nums; }

  /* Fluent progress bar */
  .progress-track {
    height: 2px;
    background: var(--surface3);
    border-radius: 2px;
    overflow: hidden;
    position: relative;
  }
  .progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    transition: width 0.35s cubic-bezier(0.4,0,0.2,1);
  }

  .btn-cancel {
    background: none;
    border: 1px solid var(--border-med);
    color: var(--danger);
    font-size: 11px;
    padding: 3px 10px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    align-self: flex-start;
    transition: background 0.15s;
    font-family: var(--sans);
  }
  .btn-cancel:hover { background: var(--danger-dim); border-color: var(--danger); }

  .import-error { font-size: 11px; color: var(--danger); padding: 0 12px 8px; }

  /* File list */
  .file-list { overflow-y: auto; flex: 1; padding: 4px 6px; }
  .empty-files {
    font-size: 12px; color: var(--text-muted);
    padding: 24px 16px; text-align: center;
  }

  /* Fluent ListItem */
  .file-item {
    width: 100%; background: none; border: none;
    padding: 8px 10px;
    display: flex; align-items: center; gap: 10px;
    cursor: pointer; text-align: left;
    border-radius: var(--radius);
    transition: background 0.1s;
    margin-bottom: 2px;
  }
  .file-item:hover { background: var(--surface2); }
  .file-item:active { background: var(--surface3); }
  .file-item--active {
    background: var(--accent-dim);
  }

  /* File icon accent bar replaced by colored dot */
  .file-info { flex: 1; min-width: 0; }
  .file-name {
    display: block;
    font-size: 13px;
    font-weight: 400;
    color: var(--text);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .file-item--active .file-name { color: var(--accent); font-weight: 600; }
  .file-meta {
    display: block;
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 1px;
    font-variant-numeric: tabular-nums;
  }
  .file-delete {
    font-size: 14px; color: var(--text-muted); line-height: 1;
    width: 20px; height: 20px; border-radius: var(--radius-sm);
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 0.15s, background 0.15s, color 0.15s;
    flex-shrink: 0;
  }
  .file-item:hover .file-delete { opacity: 1; }
  .file-delete:hover { background: var(--danger-dim); color: var(--danger); }

  /* ══════════════════════════════════════════
     CONTENT AREA
  ══════════════════════════════════════════ */
  .content {
    display: flex; flex-direction: column; overflow: hidden;
    background: var(--bg-content);
  }

  .content-header {
    padding: 20px 28px 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    background: var(--bg-content);
  }

  .content-header-row { display: flex; align-items: center; gap: 12px; }

  .content-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--text);
    letter-spacing: -0.01em;
  }

  .content-sub {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 3px;
    display: block;
  }
  .content-hint { color: var(--text-muted); }

  .header-sel-badge {
    font-size: 12px; font-weight: 600;
    background: var(--accent);
    color: #fff;
    padding: 2px 10px;
    border-radius: var(--radius-xl);
    animation: badgePop 0.15s cubic-bezier(0.34,1.56,0.64,1);
  }
  @keyframes badgePop { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }

  /* ── Virtualized Grid ── */
  .vgrid-scroll {
    flex: 1; overflow-y: auto; overflow-x: hidden;
    padding: 20px 28px; position: relative;
    user-select: none;
    background: var(--bg);
  }
  .vgrid-loader { position: sticky; bottom: 20px; display: flex; justify-content: center; pointer-events: none; }

  /* ══════════════════════════════════════════
     PRODUCT CARD — Fluent card style
  ══════════════════════════════════════════ */
  .good-card {
    background: var(--bg-content);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    height: 278px;
    display: flex; flex-direction: column;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
    cursor: pointer;
    position: relative;
    box-shadow: var(--shadow-sm);
  }
  .good-card:hover {
    border-color: rgba(0,120,212,0.3);
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }
  .good-card--selected {
    border-color: var(--accent);
    background: var(--accent-sel);
    box-shadow: 0 0 0 2px var(--accent), var(--shadow-md);
    transform: translateY(-2px);
  }

  /* Checkbox — Fluent style */
  .card-check {
    position: absolute; top: 10px; left: 10px; z-index: 2;
    width: 20px; height: 20px;
    border-radius: var(--radius-sm);
    border: 1.5px solid rgba(255,255,255,0.9);
    background: rgba(255,255,255,0.80);
    backdrop-filter: blur(4px);
    box-shadow: 0 1px 4px rgba(0,0,0,0.18);
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
    pointer-events: none;
    opacity: 0;
  }
  .good-card:hover .card-check { opacity: 1; }
  .good-card--selected .card-check { opacity: 1; }
  .card-check--on {
    background: var(--accent);
    border-color: var(--accent);
    box-shadow: 0 1px 4px rgba(0,120,212,0.35);
  }
  .card-check svg { width: 11px; height: 11px; }
  .card-check--on svg path { stroke: #fff; }

  /* Card image */
  .card-img {
    position: relative; flex-shrink: 0; height: 178px;
    background: var(--surface2); overflow: hidden;
  }
  .card-img img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s ease; }
  .good-card:hover .card-img img { transform: scale(1.03); }
  .no-img {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: 11px; color: var(--text-muted); letter-spacing: 0.05em;
    flex-direction: column; gap: 6px;
  }
  .no-img::before {
    content: '';
    display: block;
    width: 32px; height: 32px;
    background: var(--surface3);
    border-radius: 50%;
    /* SVG image placeholder icon inline */
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a0a0a0' stroke-width='1.5'%3E%3Crect x='3' y='3' width='18' height='18' rx='3'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='M21 15l-5-5L5 21'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: center;
    background-size: 20px;
  }
  .img-count {
    position: absolute; bottom: 8px; right: 8px;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(4px);
    color: #fff;
    font-size: 10px; font-weight: 600;
    padding: 2px 7px; border-radius: var(--radius-xl);
  }

  /* Card body */
  .card-body { padding: 12px; flex: 1; overflow: hidden; }
  .card-title {
    font-size: 13px; font-weight: 500; color: var(--text);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    margin-bottom: 6px;
  }
  .card-meta {
    display: grid; grid-template-columns: auto 1fr;
    gap: 2px 8px; font-size: 11px;
  }
  .card-meta dt { color: var(--text-muted); font-weight: 400; }
  .card-meta dd { color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }

  /* ══════════════════════════════════════════
     SELECTION BAR — Fluent command bar style
  ══════════════════════════════════════════ */
  .sel-bar {
    position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 4px;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid var(--border-med);
    border-radius: var(--radius-xl);
    padding: 6px 8px;
    box-shadow: var(--shadow-fly);
    animation: barSlide 0.22s cubic-bezier(0.34,1.4,0.64,1);
    pointer-events: all; z-index: 10; white-space: nowrap;
  }
  @keyframes barSlide {
    from { transform: translateX(-50%) translateY(16px); opacity: 0; }
    to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
  }

  .sel-count {
    font-size: 13px; font-weight: 600; color: var(--text);
    padding: 0 8px;
  }
  .sel-num { color: var(--accent); }

  .sel-divider { width: 1px; height: 22px; background: var(--border-med); margin: 0 4px; }

  .sel-actions { display: flex; gap: 2px; align-items: center; }

  /* Fluent command button */
  .sel-btn {
    background: none; border: none;
    color: var(--text);
    font-size: 13px;
    font-family: var(--sans);
    padding: 6px 12px;
    border-radius: var(--radius);
    cursor: pointer;
    transition: background 0.12s;
    display: flex; align-items: center; gap: 6px;
    white-space: nowrap;
  }
  .sel-btn:hover { background: var(--surface2); }
  .sel-btn:active { background: var(--surface3); }
  .sel-btn--danger { color: var(--danger); }
  .sel-btn--danger:hover { background: var(--danger-dim); }
  .sel-btn--accent { color: var(--accent); font-weight: 600; }
  .sel-btn--accent:hover { background: var(--accent-dim); }

  /* ══════════════════════════════════════════
     EXPORT MENU
  ══════════════════════════════════════════ */
  .export-wrap { position: relative; }

  .export-icon    { width: 14px; height: 14px; flex-shrink: 0; }
  .export-chevron { width: 9px; height: 6px; flex-shrink: 0; transition: transform 0.15s; }
  .export-chevron.open { transform: rotate(180deg); }

  /* Fluent flyout */
  .export-dropdown {
    position: absolute; bottom: calc(100% + 10px); left: 50%;
    transform: translateX(-50%);
    background: rgba(255,255,255,0.95);
    backdrop-filter: blur(24px) saturate(180%);
    border: 1px solid var(--border-med);
    border-radius: var(--radius-lg);
    padding: 6px;
    min-width: 220px;
    box-shadow: var(--shadow-fly);
    animation: dropUp 0.18s cubic-bezier(0.34,1.3,0.64,1);
    z-index: 20;
  }
  @keyframes dropUp {
    from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.97); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  }

  .export-opt {
    width: 100%; background: none; border: none; padding: 10px 12px;
    display: flex; align-items: center; gap: 12px; cursor: pointer;
    border-radius: var(--radius); transition: background 0.1s; text-align: left;
    font-family: var(--sans);
  }
  .export-opt:hover { background: var(--surface2); }
  .export-opt:active { background: var(--surface3); }
  .export-opt-badge {
    font-size: 11px; font-weight: 700; font-family: var(--mono);
    color: var(--accent); background: var(--accent-dim);
    padding: 2px 8px; border-radius: var(--radius-sm);
    letter-spacing: 0.04em; flex-shrink: 0;
  }
  .export-opt-desc { font-size: 12px; color: var(--text-dim); }

  /* Busy state */
  .export-busy { display: flex; align-items: center; gap: 8px; padding: 0 4px; }
  .export-busy-label { font-size: 12px; color: var(--text-dim); }
  .export-busy-bar {
    width: 72px; height: 2px;
    background: var(--surface3);
    border-radius: 2px; overflow: hidden; flex-shrink: 0;
  }
  .export-busy-fill {
    height: 100%; background: var(--accent);
    transition: width 0.35s cubic-bezier(0.4,0,0.2,1);
    border-radius: 2px;
  }

  /* Done state */
  .export-done {
    display: flex; align-items: center; gap: 6px; padding: 0 4px;
    font-size: 12px; color: var(--green);
    animation: fadePop 0.2s ease;
  }
  .export-done-icon { width: 14px; height: 14px; flex-shrink: 0; }
  @keyframes fadePop { from { opacity: 0; } to { opacity: 1; } }

  .export-error { font-size: 11px; color: var(--danger); padding: 0 4px; }

  /* ══════════════════════════════════════════
     SKELETON / SPINNER / EMPTY
  ══════════════════════════════════════════ */
  .card-skeleton {
    background: var(--bg-content);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    height: 278px;
    overflow: hidden;
    position: relative;
  }
  /* Shimmer wave */
  .card-skeleton::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.04) 50%, transparent 100%);
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }
  @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

  .empty-state {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 12px;
    color: var(--text-muted); font-size: 14px;
    background: var(--bg);
  }
  .empty-state::before {
    content: '';
    display: block; width: 64px; height: 64px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48' fill='none'%3E%3Crect x='6' y='8' width='36' height='32' rx='4' stroke='%23c8c8c8' stroke-width='2'/%3E%3Cline x1='14' y1='18' x2='34' y2='18' stroke='%23c8c8c8' stroke-width='2' stroke-linecap='round'/%3E%3Cline x1='14' y1='24' x2='28' y2='24' stroke='%23c8c8c8' stroke-width='2' stroke-linecap='round'/%3E%3Cline x1='14' y1='30' x2='22' y2='30' stroke='%23c8c8c8' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-size: contain;
    opacity: 0.6;
  }

  /* Fluent spinner — ring */
  .spinner {
    width: 20px; height: 20px;
    border: 2px solid var(--border-med);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    background: rgba(255,255,255,0.7);
    backdrop-filter: blur(4px);
    padding: 2px;
    box-sizing: content-box;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Scrollbars — Windows 11 thin style ── */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: rgba(0,0,0,0.15);
    border-radius: 10px;
    border: 1px solid transparent;
    background-clip: padding-box;
  }
  ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.28); background-clip: padding-box; }
`;
