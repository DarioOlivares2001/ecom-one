"use client";

import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  SECTION_REGISTRY,
  type ProductSectionType,
} from "@/lib/product/sections/types";

interface AddSectionMenuProps {
  onAdd: (type: ProductSectionType) => void;
  disabled?: boolean;
}

export function AddSectionMenu({ onAdd, disabled = false }: AddSectionMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickAway(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
        Agregar bloque
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-30 mt-2 w-72 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg"
        >
          {SECTION_REGISTRY.map((entry) => (
            <button
              key={entry.type}
              type="button"
              role="menuitem"
              onClick={() => {
                onAdd(entry.type);
                setOpen(false);
              }}
              className="block w-full px-3 py-2.5 text-left transition hover:bg-zinc-50"
            >
              <p className="text-sm font-semibold text-zinc-900">{entry.label}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{entry.description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
