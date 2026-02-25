// hooks/useSelection.ts
//
// Персистирует Set<number> (goods_id) в localStorage с ключом по fileId.
// Формат хранения: JSON-массив чисел — компактно и быстро парсится.
//
// Дополнительно запоминает последний активный fileId, чтобы восстановить
// его после перезагрузки страницы.

import { useCallback, useRef, useState } from "react";

const SELECTION_KEY = (fileId: number) => `sel_file_${fileId}`;
const ACTIVE_FILE_KEY = "active_file_id";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readSelection(fileId: number): Set<number> {
  try {
    const raw = localStorage.getItem(SELECTION_KEY(fileId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr as number[]);
  } catch {
    return new Set();
  }
}

function writeSelection(fileId: number, sel: Set<number>): void {
  try {
    if (sel.size === 0) {
      localStorage.removeItem(SELECTION_KEY(fileId));
    } else {
      localStorage.setItem(
        SELECTION_KEY(fileId),
        JSON.stringify(Array.from(sel)),
      );
    }
  } catch {
    // localStorage может быть недоступен (приватный режим, переполнение)
    // молча игнорируем
  }
}

function readActiveFileId(): number | null {
  try {
    const raw = localStorage.getItem(ACTIVE_FILE_KEY);
    if (!raw) return null;
    const id = Number(raw);
    return isNaN(id) ? null : id;
  } catch {
    return null;
  }
}

function writeActiveFileId(id: number | null): void {
  try {
    if (id === null) localStorage.removeItem(ACTIVE_FILE_KEY);
    else localStorage.setItem(ACTIVE_FILE_KEY, String(id));
  } catch {}
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseSelectionReturn {
  activeFileId: number | null;
  selection: Set<number>;
  setActiveFileId: (id: number | null) => void;
  setSelection: (next: Set<number>) => void;
  clearSelection: () => void;
  clearAll: (fileId: number) => void; // используется при удалении файла
}

export function useSelection(): UseSelectionReturn {
  // Восстанавливаем activeFileId из localStorage при первом рендере
  const [activeFileId, setActiveFileIdState] = useState<number | null>(() =>
    readActiveFileId(),
  );

  // Восстанавливаем selection для текущего activeFileId
  const [selection, setSelectionState] = useState<Set<number>>(() =>
    activeFileId !== null ? readSelection(activeFileId) : new Set(),
  );

  // Ref чтобы не было stale closure в writeSelection при размонтировании
  const activeFileIdRef = useRef(activeFileId);
  activeFileIdRef.current = activeFileId;

  // ── setActiveFileId ────────────────────────────────────────────────────────
  // При смене файла — загружаем selection нового файла из localStorage.
  // Текущий selection уже персистирован (см. setSelection ниже), не теряем.
  const setActiveFileId = useCallback((id: number | null) => {
    setActiveFileIdState(id);
    writeActiveFileId(id);
    // Подгружаем selection нового файла
    const saved = id !== null ? readSelection(id) : new Set<number>();
    setSelectionState(saved);
  }, []);

  // ── setSelection ───────────────────────────────────────────────────────────
  // Обновляем стейт и сразу пишем в localStorage.
  const setSelection = useCallback((next: Set<number>) => {
    setSelectionState(next);
    if (activeFileIdRef.current !== null) {
      writeSelection(activeFileIdRef.current, next);
    }
  }, []);

  // ── clearSelection ─────────────────────────────────────────────────────────
  const clearSelection = useCallback(() => {
    setSelectionState(new Set());
    if (activeFileIdRef.current !== null) {
      localStorage.removeItem(SELECTION_KEY(activeFileIdRef.current));
    }
  }, []);

  // ── clearAll ───────────────────────────────────────────────────────────────
  // Вызывается при удалении файла — чистим localStorage и сбрасываем стейт
  const clearAll = useCallback((fileId: number) => {
    localStorage.removeItem(SELECTION_KEY(fileId));
    if (activeFileIdRef.current === fileId) {
      setActiveFileIdState(null);
      writeActiveFileId(null);
      setSelectionState(new Set());
    }
  }, []);

  return {
    activeFileId,
    selection,
    setActiveFileId,
    setSelection,
    clearSelection,
    clearAll,
  };
}
