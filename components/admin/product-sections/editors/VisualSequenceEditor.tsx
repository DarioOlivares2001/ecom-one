"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import type { VisualSequenceData, VisualSlide } from "@/lib/product/sections/types";

import { inputCls, uploadProductSectionImage } from "../shared";

interface VisualSequenceEditorProps {
  data: VisualSequenceData;
  onChange: (next: VisualSequenceData) => void;
}

const MAX_SLIDES = 12;

export function VisualSequenceEditor({ data, onChange }: VisualSequenceEditorProps) {
  const slides = data.slides ?? [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(next: Partial<VisualSequenceData>) {
    onChange({ ...data, ...next });
  }

  function updateSlide(index: number, patchSlide: Partial<VisualSlide>) {
    patch({ slides: slides.map((s, i) => (i === index ? { ...s, ...patchSlide } : s)) });
  }

  function removeSlide(index: number) {
    patch({ slides: slides.filter((_, i) => i !== index) });
  }

  function moveSlide(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= slides.length) return;
    const next = [...slides];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    patch({ slides: next });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || slides.length >= MAX_SLIDES) return;
    setBusy(true);
    setError(null);
    try {
      const url = await uploadProductSectionImage(file);
      patch({ slides: [...slides, { image_url: url, alt: "" }] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir la imagen.");
    } finally {
      setBusy(false);
    }
  }

  const addDisabled = busy || slides.length >= MAX_SLIDES;

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
        Usa 3 a 6 creativos cuadrados 1080 × 1080. El texto debe venir integrado en la imagen.
      </p>

      {slides.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {slides.map((slide, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-2.5"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={slide.image_url} alt="" className="h-full w-full object-cover" />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-xs font-semibold text-zinc-500">Lámina {i + 1}</span>
                <input
                  className={inputCls}
                  value={slide.alt ?? ""}
                  onChange={(e) => updateSlide(i, { alt: e.target.value })}
                  placeholder="Texto alternativo (opcional)"
                  maxLength={180}
                />
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveSlide(i, -1)}
                  disabled={i === 0}
                  className="rounded-md p-1 text-zinc-500 hover:bg-white hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Subir"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSlide(i, 1)}
                  disabled={i === slides.length - 1}
                  className="rounded-md p-1 text-zinc-500 hover:bg-white hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Bajar"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeSlide(i)}
                  className="rounded-md p-1 text-zinc-500 hover:bg-white hover:text-rose-600"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <label
        className={`inline-flex w-fit items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-xs font-semibold transition ${
          addDisabled
            ? "cursor-not-allowed border-zinc-200 text-zinc-400 opacity-60"
            : "cursor-pointer border-zinc-300 text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50"
        }`}
      >
        <Plus className="h-3.5 w-3.5" />
        Agregar imagen ({slides.length}/{MAX_SLIDES})
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          disabled={addDisabled}
          onChange={(ev) => void onFile(ev)}
        />
      </label>
      {busy && <p className="text-xs text-zinc-500">Subiendo…</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
