"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";

import type { VisualSequenceData, VisualSlide } from "@/lib/product/sections/types";

import { LIBRARY_IMAGE_DRAG_MIME } from "../ImagePicker";
import { inputCls } from "../shared";

interface VisualSequenceEditorProps {
  data: VisualSequenceData;
  onChange: (next: VisualSequenceData) => void;
  images: string[];
}

const MAX_SLIDES = 12;

export function VisualSequenceEditor({ data, onChange, images }: VisualSequenceEditorProps) {
  const slides = data.slides ?? [];
  const [browsing, setBrowsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

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

  function addSlide(url: string) {
    if (slides.length >= MAX_SLIDES) return;
    patch({ slides: [...slides, { image_url: url, alt: "" }] });
    setBrowsing(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const url =
      e.dataTransfer.getData(LIBRARY_IMAGE_DRAG_MIME) || e.dataTransfer.getData("text/plain");
    if (url && images.includes(url)) addSlide(url);
  }

  const addDisabled = slides.length >= MAX_SLIDES;

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
        Usa 3 a 6 creativos cuadrados 1080 × 1080. El texto debe venir integrado en la imagen.
      </p>

      {slides.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {slides.map((slide, i) => {
            const missing = !images.includes(slide.image_url);
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-2.5"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-white">
                  {missing ? (
                    <div className="flex h-full w-full items-center justify-center text-center text-[8px] text-amber-600">
                      Imagen no disponible
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={slide.image_url} alt="" className="h-full w-full object-cover" />
                  )}
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
                    aria-label="Quitar de la secuencia"
                    title="Quitar de la secuencia (no se borra de la biblioteca)"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={clsx(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors",
          dragOver ? "border-[var(--color-primary)] bg-zinc-50" : "border-zinc-200"
        )}
      >
        <p className="text-xs text-zinc-500">Arrastra una miniatura de la biblioteca aquí</p>
        <button
          type="button"
          onClick={() => setBrowsing((v) => !v)}
          disabled={addDisabled || images.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar desde biblioteca ({slides.length}/{MAX_SLIDES})
        </button>
        {images.length === 0 && (
          <p className="text-[11px] text-zinc-400">
            Sube imágenes en la Biblioteca de medios para poder elegirlas aquí.
          </p>
        )}
      </div>

      {browsing && images.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-2.5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Elige una imagen de la biblioteca
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {images.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => addSlide(url)}
                disabled={addDisabled}
                className="relative aspect-square overflow-hidden rounded-md border-2 border-zinc-200 transition-colors hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
