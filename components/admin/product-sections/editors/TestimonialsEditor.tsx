"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import type {
  TestimonialItem,
  TestimonialsData,
} from "@/lib/product/sections/types";

import { inputCls, labelCls, textareaCls } from "../shared";

interface TestimonialsEditorProps {
  data: TestimonialsData;
  onChange: (next: TestimonialsData) => void;
}

const MIN_ITEMS = 1;
const MAX_ITEMS = 12;
const RATING_OPTIONS = [0, 1, 2, 3, 4, 5] as const;

/**
 * El schema acepta `rating` 1–5 o `undefined` (sin calificación).
 * En la UI mapeamos 0 → undefined para que el usuario pueda elegir "Sin calificación".
 */
function ratingFromSelect(value: number): TestimonialItem["rating"] {
  if (value < 1) return undefined;
  if (value > 5) return 5;
  return value as 1 | 2 | 3 | 4 | 5;
}

export function TestimonialsEditor({ data, onChange }: TestimonialsEditorProps) {
  const items = data.items ?? [];

  function patch(next: Partial<TestimonialsData>) {
    onChange({ ...data, ...next });
  }

  function updateItem(index: number, patchItem: Partial<TestimonialItem>) {
    const nextItems = items.map((it, i) => (i === index ? { ...it, ...patchItem } : it));
    patch({ items: nextItems });
  }

  function addItem() {
    if (items.length >= MAX_ITEMS) return;
    patch({
      items: [
        ...items,
        {
          name: "Nuevo cliente",
          city: "",
          rating: 5,
          comment: "Comentario corto del cliente.",
          photo_url: "",
          date_label: "",
        },
      ],
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
          placeholder='Ej: "Lo que dicen quienes ya lo probaron"'
          maxLength={80}
        />
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-500">
                Testimonio {i + 1}
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

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Nombre</label>
                <input
                  className={inputCls}
                  value={item.name}
                  maxLength={60}
                  onChange={(e) => updateItem(i, { name: e.target.value })}
                  placeholder="Camila P."
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Ciudad (opcional)</label>
                <input
                  className={inputCls}
                  value={item.city ?? ""}
                  maxLength={60}
                  onChange={(e) => updateItem(i, { city: e.target.value })}
                  placeholder="Santiago"
                />
              </div>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Calificación</label>
                <select
                  className={inputCls}
                  value={item.rating ?? 0}
                  onChange={(e) =>
                    updateItem(i, { rating: ratingFromSelect(Number(e.target.value)) })
                  }
                >
                  {RATING_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r === 0 ? "Sin calificación" : `${r} ${r === 1 ? "estrella" : "estrellas"}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Fecha (texto libre, opcional)</label>
                <input
                  className={inputCls}
                  value={item.date_label ?? ""}
                  maxLength={40}
                  onChange={(e) => updateItem(i, { date_label: e.target.value })}
                  placeholder="hace 2 semanas"
                />
              </div>
            </div>

            <div className="mt-2 flex flex-col gap-1.5">
              <label className={labelCls}>Comentario</label>
              <textarea
                className={textareaCls}
                value={item.comment}
                rows={3}
                maxLength={400}
                onChange={(e) => updateItem(i, { comment: e.target.value })}
                placeholder="Cita real del cliente."
              />
            </div>

            <div className="mt-2 flex flex-col gap-1.5">
              <label className={labelCls}>Foto (URL, opcional)</label>
              <input
                className={inputCls}
                value={item.photo_url ?? ""}
                onChange={(e) => updateItem(i, { photo_url: e.target.value })}
                placeholder="https://..."
                inputMode="url"
              />
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
        Agregar testimonio ({items.length}/{MAX_ITEMS})
      </button>
    </div>
  );
}
