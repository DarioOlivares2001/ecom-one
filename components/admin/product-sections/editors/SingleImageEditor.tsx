"use client";

import type { MeasurementsData, UsageData, VersatilityData } from "@/lib/product/sections/types";

import { ImagePicker } from "../ImagePicker";
import { inputCls, labelCls } from "../shared";

type SingleImageData = UsageData | MeasurementsData | VersatilityData;

interface SingleImageEditorProps {
  data: SingleImageData;
  onChange: (next: SingleImageData) => void;
  images: string[];
  headingPlaceholder: string;
}

/**
 * Editor compartido por los bloques de una sola imagen principal: "Uso / Cómo
 * usar", "Medidas" y "Versatilidad". Mismo shape de datos, solo cambia el
 * texto de ayuda según el tipo de bloque.
 */
export function SingleImageEditor({
  data,
  onChange,
  images,
  headingPlaceholder,
}: SingleImageEditorProps) {
  function patch(next: Partial<SingleImageData>) {
    onChange({ ...data, ...next });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Título de la sección (opcional)</label>
        <input
          className={inputCls}
          value={data.heading ?? ""}
          onChange={(e) => patch({ heading: e.target.value })}
          placeholder={headingPlaceholder}
          maxLength={80}
        />
      </div>

      <ImagePicker
        label="Imagen de la sección"
        images={images}
        value={data.image_url}
        onChange={(url) => patch({ image_url: url })}
      />

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Texto alternativo (alt, opcional)</label>
        <input
          className={inputCls}
          value={data.alt ?? ""}
          onChange={(e) => patch({ alt: e.target.value })}
          placeholder="Descripción para accesibilidad"
          maxLength={180}
        />
      </div>
    </div>
  );
}
