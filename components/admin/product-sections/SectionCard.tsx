"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  SECTION_REGISTRY,
  type ProductSection,
} from "@/lib/product/sections/types";

interface SectionCardProps {
  section: ProductSection;
  position: number;
  total: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  children: ReactNode;
}

export function SectionCard({
  section,
  position,
  total,
  expanded,
  onToggleExpand,
  onToggleEnabled,
  onMoveUp,
  onMoveDown,
  onRemove,
  children,
}: SectionCardProps) {
  const entry = SECTION_REGISTRY.find((e) => e.type === section.type);
  const label = entry?.label ?? section.type;

  return (
    <div
      className={`rounded-lg border bg-white transition ${
        section.enabled ? "border-zinc-200" : "border-zinc-200 opacity-70"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2.5">
        <button
          type="button"
          onClick={onToggleExpand}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          aria-label={expanded ? "Colapsar" : "Expandir"}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900">
            {position + 1}. {label}
          </p>
          <p className="text-[11px] text-zinc-500">
            {section.enabled ? "Visible en la ficha" : "Oculto"}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {/* Enabled toggle */}
          <button
            type="button"
            onClick={onToggleEnabled}
            aria-label={section.enabled ? "Ocultar bloque" : "Activar bloque"}
            className="flex items-center"
          >
            <div
              className={`relative h-5 w-9 rounded-full transition-colors ${
                section.enabled ? "bg-emerald-500" : "bg-zinc-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  section.enabled ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </div>
          </button>

          <button
            type="button"
            onClick={onMoveUp}
            disabled={position === 0}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Subir bloque"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={position === total - 1}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Bajar bloque"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-rose-600"
            aria-label="Eliminar bloque"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && <div className="p-3 sm:p-4">{children}</div>}
    </div>
  );
}
