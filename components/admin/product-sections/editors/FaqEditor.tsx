"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import type { FaqData, FaqItem } from "@/lib/product/sections/types";

import { inputCls, labelCls, textareaCls } from "../shared";

interface FaqEditorProps {
  data: FaqData;
  onChange: (next: FaqData) => void;
}

const MIN_ITEMS = 1;
const MAX_ITEMS = 20;

export function FaqEditor({ data, onChange }: FaqEditorProps) {
  const items = data.items ?? [];

  function patch(next: Partial<FaqData>) {
    onChange({ ...data, ...next });
  }

  function updateItem(index: number, patchItem: Partial<FaqItem>) {
    const nextItems = items.map((it, i) => (i === index ? { ...it, ...patchItem } : it));
    patch({ items: nextItems });
  }

  function addItem() {
    if (items.length >= MAX_ITEMS) return;
    patch({
      items: [...items, { question: "Nueva pregunta", answer: "Respuesta clara y breve." }],
    });
  }

  function removeItem(index: number) {
    if (items.length <= MIN_ITEMS) return;
    patch({ items: items.filter((_, i) => i !== index) });
  }

  function moveItem(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    const next = [...items];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    patch({ items: next });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Título de la sección (opcional)</label>
        <input
          className={inputCls}
          value={data.heading ?? ""}
          onChange={(e) => patch({ heading: e.target.value })}
          placeholder='Ej: "Preguntas frecuentes"'
          maxLength={80}
        />
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-500">
                Pregunta {i + 1}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveItem(i, -1)}
                  disabled={i === 0}
                  className="rounded-md p-1 text-zinc-500 hover:bg-white hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Subir"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(i, 1)}
                  disabled={i === items.length - 1}
                  className="rounded-md p-1 text-zinc-500 hover:bg-white hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Bajar"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  disabled={items.length <= MIN_ITEMS}
                  className="rounded-md p-1 text-zinc-500 hover:bg-white hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Pregunta</label>
                <input
                  className={inputCls}
                  value={item.question}
                  maxLength={180}
                  onChange={(e) => updateItem(i, { question: e.target.value })}
                  placeholder="Ej: ¿Cuánto demora el envío?"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Respuesta</label>
                <textarea
                  className={textareaCls}
                  value={item.answer}
                  rows={3}
                  maxLength={800}
                  onChange={(e) => updateItem(i, { answer: e.target.value })}
                  placeholder="Respuesta directa y útil. Se respetan los saltos de línea."
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addItem}
        disabled={items.length >= MAX_ITEMS}
        className="inline-flex w-fit items-center gap-1.5 rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
        Agregar pregunta ({items.length}/{MAX_ITEMS})
      </button>
    </div>
  );
}
