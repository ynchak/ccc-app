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

export const Route = createFileRoute("/")({
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
      <div className="progress-fill" style={{ width: "${value}%" }} />
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
          <div className="export-busy-fill" style={{ width: "${progress}%" }} />
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
          className={`export-chevron${open ? ` open` : ``}`}
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
  const images = good.goods_images_url || [];
  const [currentImgIdx, setCurrentImgIdx] = useState(0);

  // Переключение фото
  const handlePrevImg = (e: React.MouseEvent) => {
    e.stopPropagation(); // Чтобы не выбралась карточка
    setCurrentImgIdx((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNextImg = (e: React.MouseEvent) => {
    e.stopPropagation(); // Чтобы не выбралась карточка
    setCurrentImgIdx((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handleOpenInNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `https://gomer.rozetka.company/gomer/items/source/${good.gomer_sync_source_id}?ItemSearch[id]=${good.goods_id}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleClick = useCallback(
    (e: React.MouseEvent) => onSelect(good.goods_id, idx, e.shiftKey),
    [good.goods_id, idx, onSelect],
  );

  return (
    <article
      className={`good-card${selected ? ` good-card--selected` : ``}`}
      onClick={handleClick}
    >
      {/* Чекбокс */}
      <div className={`card-check${selected ? ` card-check--on` : ``}`}>
        {selected && (
          <svg viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        )}
      </div>

      {/* Слайдер изображений */}
      <div className="card-img slider-container">
  {images.length > 0 ? (
    <>
      <img src={images[currentImgIdx]} alt={good.goods_title} loading="lazy" />
      
      {images.length > 1 && (
        <>
          {/* Кнопки теперь внутри контейнера с картинкой */}
          <button type="button" className="slider-arrow prev" onClick={handlePrevImg}>
            <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          </button>
          
          <button type="button" className="slider-arrow next" onClick={handleNextImg}>
            <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </button>

          <div className="img-badge">
            {currentImgIdx + 1} / {images.length}
          </div>
        </>
      )}
    </>
  ) : (
    <span className="no-img">NO IMG</span>
  )}
</div>

      <div className="card-body">
        <p className="card-title">{good.goods_title || "—"}</p>
        <div className="card-actions">
          <button className="open-btn" onClick={handleOpenInNewTab}>
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
            className={`drop-zone${isImporting ? ` drop-zone--disabled` : ``}`}
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
                className={`file-item${activeFileId === f.id ? ` file-item--active` : ``}`}
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
