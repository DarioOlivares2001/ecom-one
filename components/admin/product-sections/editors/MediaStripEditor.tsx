"use client";

import { MEDIA_STRIP_ASPECTS, type MediaStripData } from "@/lib/product/sections/types";

import { inputCls, labelCls } from "../shared";

interface MediaStripEditorProps {
  data: MediaStripData;
  onChange: (next: MediaStripData) => void;
}

const ASPECT_LABEL: Record<MediaStripData["aspect"], string> = {
  "16/9": "Panorámica (16:9)",
  "4/3": "Estándar (4:3)",
  "1/1": "Cuadrada (1:1)",
};

export function MediaStripEditor({ data, onChange }: MediaStripEditorProps) {
  function patch(next: Partial<MediaStripData>) {
    onChange({ ...data, ...next });
  }

  const hasImage = data.image_url.trim().length > 0;
  const looksLikeUrl = /^https?:\/\//i.test(data.image_url.trim());
  const urlInvalid = hasImage && !looksLikeUrl;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>URL de la imagen</label>
        <input
          className={inputCls}
          value={data.image_url}
          onChange={(e) => patch({ image_url: e.target.value })}
          placeholder="https://..."
          inputMode="url"
        />
        {urlInvalid && (
          <p className="text-xs text-rose-600">
            La URL debe empezar con http:// o https://.
          </p>
        )}
        {!hasImage && (
          <p className="text-xs text-zinc-500">
            Pega aquí la URL pública de la imagen. Próximamente vamos a sumar carga directa.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Texto alternativo (alt)</label>
          <input
            className={inputCls}
            value={data.alt ?? ""}
            onChange={(e) => patch({ alt: e.target.value })}
            placeholder="Descripción para accesibilidad"
            maxLength={180}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Proporción</label>
          <select
            className={inputCls}
            value={data.aspect}
            onChange={(e) =>
              patch({ aspect: e.target.value as MediaStripData["aspect"] })
            }
          >
            {MEDIA_STRIP_ASPECTS.map((a) => (
              <option key={a} value={a}>
                {ASPECT_LABEL[a]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Leyenda (opcional)</label>
        <input
          className={inputCls}
          value={data.caption ?? ""}
          onChange={(e) => patch({ caption: e.target.value })}
          placeholder="Texto pequeño debajo de la imagen"
          maxLength={140}
        />
      </div>

      {hasImage && looksLikeUrl && (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.image_url}
            alt={data.alt ?? data.caption ?? ""}
            className="block w-full"
            style={{ maxHeight: 280, objectFit: "cover" }}
            loading="lazy"
            decoding="async"
          />
        </div>
      )}
    </div>
  );
}
