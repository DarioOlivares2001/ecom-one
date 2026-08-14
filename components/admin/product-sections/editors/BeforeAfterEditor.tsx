"use client";

import { useState } from "react";

import type { BeforeAfterData } from "@/lib/product/sections/types";

import { inputCls, labelCls, uploadProductSectionImage } from "../shared";

interface BeforeAfterEditorProps {
  data: BeforeAfterData;
  onChange: (next: BeforeAfterData) => void;
}

interface ImageUploadSlotProps {
  label: string;
  imageUrl: string;
  onUploaded: (url: string) => void;
}

function ImageUploadSlot({ label, imageUrl, onUploaded }: ImageUploadSlotProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const url = await uploadProductSectionImage(file);
      onUploaded(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir la imagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelCls}>{label}</label>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-[repeating-conic-gradient(#e5e7eb_0%_25%,white_0%_50%)] bg-[length:12px_12px]">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={`Vista previa ${label}`} className="h-full w-full object-cover" />
          ) : (
            <span className="text-[9px] text-zinc-400">Sin imagen</span>
          )}
        </div>
        <label className="flex cursor-pointer flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">
            {imageUrl ? "Cambiar imagen" : "Subir imagen"}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="text-xs file:mr-2 file:rounded file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-white"
            disabled={busy}
            onChange={(ev) => void onFile(ev)}
          />
        </label>
      </div>
      {busy && <p className="text-xs text-zinc-500">Subiendo…</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function BeforeAfterEditor({ data, onChange }: BeforeAfterEditorProps) {
  function patch(next: Partial<BeforeAfterData>) {
    onChange({ ...data, ...next });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Título de la sección (opcional)</label>
        <input
          className={inputCls}
          value={data.heading ?? ""}
          onChange={(e) => patch({ heading: e.target.value })}
          placeholder='Ej: "Antes y después"'
          maxLength={80}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50/40 p-3">
          <ImageUploadSlot
            label='Imagen "Antes"'
            imageUrl={data.before_image_url ?? ""}
            onUploaded={(url) => patch({ before_image_url: url })}
          />
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Etiqueta (opcional)</label>
            <input
              className={inputCls}
              value={data.before_title ?? ""}
              onChange={(e) => patch({ before_title: e.target.value })}
              placeholder="Antes"
              maxLength={80}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
          <ImageUploadSlot
            label='Imagen "Después"'
            imageUrl={data.after_image_url ?? ""}
            onUploaded={(url) => patch({ after_image_url: url })}
          />
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Etiqueta (opcional)</label>
            <input
              className={inputCls}
              value={data.after_title ?? ""}
              onChange={(e) => patch({ after_title: e.target.value })}
              placeholder="Después"
              maxLength={80}
            />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-zinc-500">
        Sube ambas imágenes para activar el comparador en la ficha. Usa fotos reales y autorizadas
        del producto — no sugieras resultados garantizados.
      </p>
    </div>
  );
}
