"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import {
  BENEFIT_ICONS,
  type BenefitItem,
  type BenefitsData,
} from "@/lib/product/sections/types";

import { inputCls, labelCls, textareaCls } from "../shared";

interface BenefitsEditorProps {
  data: BenefitsData;
  onChange: (next: BenefitsData) => void;
}

const ICON_LABELS: Record<(typeof BENEFIT_ICONS)[number], string> = {
  shield: "🛡 Escudo",
  truck: "🚚 Envío",
  leaf: "🌿 Hoja",
  heart: "❤ Corazón",
  sparkles: "✨ Brillo",
  check: "✔ Check",
  star: "★ Estrella",
  package: "📦 Paquete",
  smile: "😊 Sonrisa",
  clock: "⏱ Reloj",
};

const MIN_ITEMS = 1;
const MAX_ITEMS = 6;

export function BenefitsEditor({ data, onChange }: BenefitsEditorProps) {
  const items = data.items ?? [];

  function patch(next: Partial<BenefitsData>) {
    onChange({ ...data, ...next });
  }

  function updateItem(index: number, patchItem: Partial<BenefitItem>) {
    const nextItems = items.map((it, i) => (i === index ? { ...it, ...patchItem } : it));
    patch({ items: nextItems });
  }

  function addItem() {
    if (items.length >= MAX_ITEMS) return;
    patch({
      items: [
        ...items,
        { icon: "check", title: "Nuevo beneficio", description: "Descripción breve." },
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
          placeholder='Ej: "Por qué te va a encantar"'
          maxLength={80}
        />
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item, i) => (
          <div
            key={i}
            className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-500">
                Beneficio {i + 1}
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

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr]">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Icono</label>
                <select
                  className={inputCls}
                  value={item.icon}
                  onChange={(e) =>
                    updateItem(i, { icon: e.target.value as BenefitItem["icon"] })
                  }
                >
                  {BENEFIT_ICONS.map((ic) => (
                    <option key={ic} value={ic}>
                      {ICON_LABELS[ic]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Título</label>
                <input
                  className={inputCls}
                  value={item.title}
                  maxLength={60}
                  onChange={(e) => updateItem(i, { title: e.target.value })}
                  placeholder="Ej: Envío rápido"
                />
              </div>
            </div>

            <div className="mt-2 flex flex-col gap-1.5">
              <label className={labelCls}>Descripción</label>
              <textarea
                className={textareaCls}
                value={item.description}
                rows={2}
                maxLength={240}
                onChange={(e) => updateItem(i, { description: e.target.value })}
                placeholder="Una línea explicando el beneficio."
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
        Agregar beneficio ({items.length}/{MAX_ITEMS})
      </button>
    </div>
  );
}
