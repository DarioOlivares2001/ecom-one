"use client";

import { MEDIA_STRIP_ASPECTS, type MediaStripData } from "@/lib/product/sections/types";

import { ImagePicker } from "../ImagePicker";
import { inputCls, labelCls, textareaCls } from "../shared";

interface MediaStripEditorProps {
  data: MediaStripData;
  onChange: (next: MediaStripData) => void;
  images: string[];
}

const ASPECT_LABEL: Record<MediaStripData["aspect"], string> = {
  "16/9": "Panorámica (16:9)",
  "4/3": "Estándar (4:3)",
  "1/1": "Cuadrada (1:1)",
};

export function MediaStripEditor({ data, onChange, images }: MediaStripEditorProps) {
  function patch(next: Partial<MediaStripData>) {
    onChange({ ...data, ...next });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Texto de la sección (opcional)</label>
        <textarea
          className={textareaCls}
          value={data.description ?? ""}
          rows={5}
          maxLength={2000}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="Copy comercial visible en la ficha. Se respetan los saltos de línea."
        />
      </div>

      <ImagePicker
        label="Imagen de la sección"
        images={images}
        value={data.image_url}
        onChange={(url) => patch({ image_url: url })}
      />

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
          <p className="text-[11px] text-zinc-500">
            Describe la imagen para accesibilidad; no se muestra como texto comercial.
          </p>
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
    </div>
  );
}
