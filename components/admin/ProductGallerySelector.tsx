"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import Image from "next/image";
import { GripVertical, ImageOff, X } from "lucide-react";
import { clsx } from "clsx";

import { LIBRARY_IMAGE_DRAG_MIME } from "./product-sections/ImagePicker";

interface ProductGallerySelectorProps {
  /** Biblioteca de medios del producto (`product_media`), fuente de la que se elige la galería. */
  library: string[];
  /** Galería pública seleccionada, en orden (`products.images`). */
  gallery: string[];
  onChange: Dispatch<SetStateAction<string[]>>;
}

/**
 * Sección obligatoria antes de "Bloques de la ficha": elige y ordena qué
 * imágenes de la biblioteca se muestran en el carrusel público, tarjetas y
 * catálogo. La primera imagen es siempre la portada. Distinta de
 * `ProductMediaLibrary`: esta solo selecciona referencias, nunca sube archivos.
 */
export function ProductGallerySelector({ library, gallery, onChange }: ProductGallerySelectorProps) {
  const [dragSrcIdx, setDragSrcIdx] = useState<number | null>(null);
  const [dropOver, setDropOver] = useState(false);

  const available = library.filter((url) => !gallery.includes(url));

  function addToGallery(url: string) {
    if (gallery.includes(url)) return;
    onChange((prev) => [...prev, url]);
  }

  function removeFromGallery(url: string) {
    onChange((prev) => prev.filter((u) => u !== url));
  }

  function handleThumbDragStart(e: React.DragEvent, idx: number) {
    e.dataTransfer.effectAllowed = "move";
    setDragSrcIdx(idx);
  }

  function handleThumbDragOver(e: React.DragEvent, toIdx: number) {
    e.preventDefault();
    if (dragSrcIdx === null || dragSrcIdx === toIdx) return;
    onChange((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragSrcIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDragSrcIdx(toIdx);
  }

  function handleDropFromLibrary(e: React.DragEvent) {
    e.preventDefault();
    setDropOver(false);
    const url =
      e.dataTransfer.getData(LIBRARY_IMAGE_DRAG_MIME) || e.dataTransfer.getData("text/plain");
    if (url && library.includes(url)) addToGallery(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDropOver(true);
        }}
        onDragLeave={() => setDropOver(false)}
        onDrop={handleDropFromLibrary}
        className={clsx(
          "rounded-lg border-2 border-dashed p-3 transition-colors",
          dropOver ? "border-[var(--color-primary)] bg-zinc-50" : "border-zinc-200"
        )}
      >
        {gallery.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <ImageOff className="h-6 w-6 text-amber-500" aria-hidden />
            <p className="text-sm font-semibold text-amber-700">
              Selecciona al menos una imagen para la galería.
            </p>
            <p className="max-w-[280px] text-xs text-zinc-500">
              Elige de la biblioteca abajo o arrastra una miniatura hasta aquí. La primera será la
              portada del producto.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
            {gallery.map((url, i) => (
              <div
                key={`${i}-${url}`}
                draggable
                onDragStart={(e) => handleThumbDragStart(e, i)}
                onDragOver={(e) => handleThumbDragOver(e, i)}
                onDragEnd={() => setDragSrcIdx(null)}
                className={clsx(
                  "group relative aspect-square cursor-grab overflow-hidden rounded-lg border-2 transition-all active:cursor-grabbing",
                  dragSrcIdx === i ? "border-[var(--color-primary)] opacity-40" : "border-zinc-200 hover:border-zinc-400"
                )}
              >
                <Image src={url} alt={`Imagen de galería ${i + 1}`} fill className="object-cover" sizes="80px" />

                <div className="absolute left-1 top-1 hidden group-hover:flex">
                  <GripVertical className="h-3.5 w-3.5 text-white drop-shadow" />
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromGallery(url);
                  }}
                  className="absolute right-0.5 top-0.5 hidden h-5 w-5 items-center justify-center rounded-full bg-zinc-900/80 text-white group-hover:flex"
                  aria-label="Quitar de la galería"
                  title="Quitar de la galería (no se borra de la biblioteca)"
                >
                  <X className="h-3 w-3" />
                </button>

                {i === 0 && (
                  <span className="absolute bottom-0 left-0 right-0 bg-zinc-900/70 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wider text-white">
                    Portada
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Elegir de la biblioteca
        </p>
        {library.length === 0 ? (
          <p className="text-xs text-zinc-400">
            Sube imágenes en la Biblioteca de medios más arriba para poder elegirlas aquí.
          </p>
        ) : available.length === 0 ? (
          <p className="text-xs text-zinc-400">Ya elegiste todas las imágenes de la biblioteca.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
            {available.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => addToGallery(url)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "copy";
                  e.dataTransfer.setData(LIBRARY_IMAGE_DRAG_MIME, url);
                  e.dataTransfer.setData("text/plain", url);
                }}
                className="relative aspect-square overflow-hidden rounded-md border-2 border-zinc-200 transition-colors hover:border-zinc-400"
                title="Agregar a la galería"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
