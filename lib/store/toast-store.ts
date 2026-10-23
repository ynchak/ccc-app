"use client";

import { create } from "zustand";

/** Простое уведомление в правом нижнем углу. */
export interface Toast {
  id: number;
  message: string;
  tone: "default" | "error" | "success";
}

interface ToastState {
  toasts: Toast[];
  show: (message: string, tone?: Toast["tone"]) => void;
  dismiss: (id: number) => void;
}

let nextToastId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show(message, tone = "default") {
    const id = nextToastId++;
    set((state) => ({
      toasts: [...state.toasts, { id, message, tone }].slice(-4),
    }));
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== id),
        }));
      }, 4000);
    }
  },
  dismiss(id) {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
}));

/** Удобный вызов уведомления вне React-компонентов. */
export function notify(message: string, tone: Toast["tone"] = "default") {
  useToastStore.getState().show(message, tone);
}
