"use client";

import { useState } from "react";
import { ImageOff, ImagePlus, X } from "lucide-react";
import { clsx } from "clsx";

import { labelCls } from "./shared";

interface ImagePickerProps {
  /** Etiqueta del campo (ej. "Imagen de la sección", 'Imagen "Antes"'). */
  label: string;
  /** URLs disponibles en la biblioteca de medios del producto, en orden de galería. */
  images: string[];
  /** URL actualmente asignada a esta sección (o "" si no hay ninguna). */
  value: string;
  onChange: (url: string) => void;
  helperText?: string;
}

/** MIME usado por el `dataTransfer` al arrastrar una miniatura desde la biblioteca. */
export const LIBRARY_IMAGE_DRAG_MIME = "text/x-product-image-url";

export function ImagePicker({ label, images, value, onChange, helperText }: ImagePickerProps) {
  const [browsing, setBrowsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const trimmed = value?.trim() ?? "";
  const hasValue = trimmed.length > 0;
  const isOrphaned = hasValue && !images.includes(trimmed);

  function selectFromLibrary(url: string) {
    onChange(url);
    setBrowsing(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const url =
      e.dataTransfer.getData(LIBRARY_IMAGE_DRAG_MIME) || e.dataTransfer.getData("text/plain");
    if (url && images.includes(url)) {
      onChange(url);
      setBrowsing(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelCls}>{label}</label>

      {hasValue ? (
        <div className="flex flex-col gap-2">
          <div className="relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
            {isOrphaned ? (
              <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
                <ImageOff className="h-6 w-6 text-amber-500" aria-hidden />
                <p className="text-xs font-semibold text-amber-700">
                  Esta imagen ya no está en la biblioteca
                </p>
                <p className="max-w-[220px] text-[11px] text-zinc-500">
                  Se eliminó de la galería del producto. Elige otra o quita la asignación.
                </p>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={trimmed}
                alt=""
                className="block max-h-64 w-full object-contain"
                loading="lazy"
                decoding="async"
              />
            )}
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900/80 text-white hover:bg-zinc-900"
              aria-label="Quitar imagen de esta sección"
              title="Quitar imagen de esta sección (no se borra de la biblioteca)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setBrowsing((v) => !v)}
            className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] hover:underline"
          >
            Cambiar imagen
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={clsx(
            "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
            dragOver ? "border-[var(--color-primary)] bg-zinc-50" : "border-zinc-200"
          )}
        >
          <ImagePlus className="h-6 w-6 text-zinc-400" aria-hidden />
          <p className="text-xs text-zinc-500">Arrastra una miniatura de la biblioteca aquí</p>
          <button
            type="button"
            onClick={() => setBrowsing((v) => !v)}
            disabled={images.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Elegir de biblioteca
          </button>
          {images.length === 0 && (
            <p className="text-[11px] text-zinc-400">
              Sube imágenes en la Biblioteca de medios para poder elegirlas aquí.
            </p>
          )}
        </div>
      )}

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
                onClick={() => selectFromLibrary(url)}
                className={clsx(
                  "relative aspect-square overflow-hidden rounded-md border-2 transition-colors",
                  trimmed === url
                    ? "border-[var(--color-primary)]"
                    : "border-zinc-200 hover:border-zinc-400"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}

      {helperText && <p className="text-[11px] text-zinc-500">{helperText}</p>}
    </div>
  );
}
