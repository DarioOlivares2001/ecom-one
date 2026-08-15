"use client";

import type { BeforeAfterData } from "@/lib/product/sections/types";

import { ImagePicker } from "../ImagePicker";
import { inputCls, labelCls } from "../shared";

interface BeforeAfterEditorProps {
  data: BeforeAfterData;
  onChange: (next: BeforeAfterData) => void;
  images: string[];
}

export function BeforeAfterEditor({ data, onChange, images }: BeforeAfterEditorProps) {
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
          <ImagePicker
            label='Imagen "Antes"'
            images={images}
            value={data.before_image_url ?? ""}
            onChange={(url) => patch({ before_image_url: url })}
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
          <ImagePicker
            label='Imagen "Después"'
            images={images}
            value={data.after_image_url ?? ""}
            onChange={(url) => patch({ after_image_url: url })}
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
        Elige ambas imágenes desde la biblioteca para activar el comparador en la ficha. Usa fotos
        reales y autorizadas del producto — no sugieras resultados garantizados.
      </p>
    </div>
  );
}
