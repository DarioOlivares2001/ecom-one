"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastStore {
  toasts: ToastItem[];
  add: (toast: Omit<ToastItem, "id">) => void;
  remove: (id: string) => void;
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add(toast) {
    const id = Math.random().toString(36).slice(2);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
  },
  remove(id) {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

export const toast = {
  success: (message: string, duration = 4000) =>
    useToastStore.getState().add({ type: "success", message, duration }),
  error: (message: string, duration = 5000) =>
    useToastStore.getState().add({ type: "error", message, duration }),
  info: (message: string, duration = 4000) =>
    useToastStore.getState().add({ type: "info", message, duration }),
};

const typeConfig: Record<
  ToastType,
  { icon: React.ElementType; bg: string; text: string; border: string }
> = {
  success: {
    icon: CheckCircle,
    bg: "bg-[var(--color-surface)]",
    text: "text-[var(--color-success)]",
    border: "border-l-4 border-l-[var(--color-success)]",
  },
  error: {
    icon: XCircle,
    bg: "bg-[var(--color-surface)]",
    text: "text-[var(--color-error)]",
    border: "border-l-4 border-l-[var(--color-error)]",
  },
  info: {
    icon: Info,
    bg: "bg-[var(--color-surface)]",
    text: "text-blue-500",
    border: "border-l-4 border-l-blue-500",
  },
};

function ToastCard({ toast: item }: { toast: ToastItem }) {
  const { remove } = useToastStore();
  const { icon: Icon, bg, text, border } = typeConfig[item.type];

  useEffect(() => {
    const timer = setTimeout(() => remove(item.id), item.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, remove]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`flex items-start gap-3 w-80 max-w-[calc(100vw-2rem)] rounded-[var(--radius-md)] p-4 shadow-[var(--shadow-md)] ${bg} ${border}`}
      role="alert"
      aria-live="assertive"
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${text}`} aria-hidden />
      <p className="flex-1 text-sm text-[var(--color-text)] leading-snug">
        {item.message}
      </p>
      <button
        onClick={() => remove(item.id)}
        className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        aria-label="Cerrar notificación"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export function Toaster() {
  const { toasts } = useToastStore();

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      aria-label="Notificaciones"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastCard toast={t} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
