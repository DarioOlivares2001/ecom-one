"use client";

import {
  BEFORE_AFTER_LAYOUTS,
  type BeforeAfterData,
  type BeforeAfterLayout,
} from "@/lib/product/sections/types";

import { inputCls, labelCls, textareaCls } from "../shared";

interface BeforeAfterEditorProps {
  data: BeforeAfterData;
  onChange: (next: BeforeAfterData) => void;
}

const LAYOUT_LABEL: Record<BeforeAfterLayout, string> = {
  side_by_side: "Lado a lado (2 columnas en desktop)",
  stacked: "Apilado (uno sobre otro)",
};

function urlLooksValid(url: string | undefined): boolean {
  if (!url || !url.trim()) return true;
  return /^https?:\/\//i.test(url.trim());
}

export function BeforeAfterEditor({ data, onChange }: BeforeAfterEditorProps) {
  function patch(next: Partial<BeforeAfterData>) {
    onChange({ ...data, ...next });
  }

  const beforeUrlInvalid = !urlLooksValid(data.before_image_url);
  const afterUrlInvalid = !urlLooksValid(data.after_image_url);

  return (
    <div className="flex flex-col gap-5">
      {/* Header común */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
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
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Distribución</label>
          <select
            className={inputCls}
            value={data.layout ?? "side_by_side"}
            onChange={(e) =>
              patch({ layout: e.target.value as BeforeAfterLayout })
            }
          >
            {BEFORE_AFTER_LAYOUTS.map((l) => (
              <option key={l} value={l}>
                {LAYOUT_LABEL[l]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Dos columnas: ANTES / DESPUÉS */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* ── ANTES ── */}
        <div className="flex flex-col gap-2.5 rounded-lg border border-rose-200 bg-rose-50/40 p-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 items-center rounded-full bg-rose-100 px-2 text-[10px] font-extrabold uppercase tracking-wider text-rose-700">
              Antes
            </span>
            <span className="text-[11px] text-rose-700/80">
              Mostrar el problema
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Título</label>
            <input
              className={inputCls}
              value={data.before_title ?? ""}
              onChange={(e) => patch({ before_title: e.target.value })}
              placeholder='Ej: "Antes" / "Sin el producto"'
              maxLength={80}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Descripción</label>
            <textarea
              className={textareaCls}
              value={data.before_description ?? ""}
              rows={5}
              maxLength={600}
              onChange={(e) => patch({ before_description: e.target.value })}
              placeholder={"Una línea por fila.\n❌ Malos olores\n❌ Arena en el piso"}
            />
            <p className="text-[11px] text-zinc-500">
              Tip: usa una línea por punto. Se respetan los saltos de línea.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>URL imagen (opcional)</label>
            <input
              className={inputCls}
              value={data.before_image_url ?? ""}
              onChange={(e) => patch({ before_image_url: e.target.value })}
              placeholder="https://..."
              inputMode="url"
            />
            {beforeUrlInvalid && (
              <p className="text-xs text-rose-600">
                La URL debe empezar con http:// o https://.
              </p>
            )}
            {data.before_image_url?.trim() && !beforeUrlInvalid && (
              <div className="mt-1 overflow-hidden rounded-md border border-rose-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={data.before_image_url.trim()}
                  alt="Preview antes"
                  className="block w-full"
                  style={{ maxHeight: 180, objectFit: "cover" }}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            )}
          </div>
        </div>

        {/* ── DESPUÉS ── */}
        <div className="flex flex-col gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 items-center rounded-full bg-emerald-100 px-2 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
              Después
            </span>
            <span className="text-[11px] text-emerald-700/80">
              Mostrar el resultado
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Título</label>
            <input
              className={inputCls}
              value={data.after_title ?? ""}
              onChange={(e) => patch({ after_title: e.target.value })}
              placeholder='Ej: "Después" / "Con el producto"'
              maxLength={80}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Descripción</label>
            <textarea
              className={textareaCls}
              value={data.after_description ?? ""}
              rows={5}
              maxLength={600}
              onChange={(e) => patch({ after_description: e.target.value })}
              placeholder={"Una línea por fila.\n✅ Ambiente limpio\n✅ Menos suciedad"}
            />
            <p className="text-[11px] text-zinc-500">
              Tip: usa una línea por punto. Se respetan los saltos de línea.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>URL imagen (opcional)</label>
            <input
              className={inputCls}
              value={data.after_image_url ?? ""}
              onChange={(e) => patch({ after_image_url: e.target.value })}
              placeholder="https://..."
              inputMode="url"
            />
            {afterUrlInvalid && (
              <p className="text-xs text-rose-600">
                La URL debe empezar con http:// o https://.
              </p>
            )}
            {data.after_image_url?.trim() && !afterUrlInvalid && (
              <div className="mt-1 overflow-hidden rounded-md border border-emerald-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={data.after_image_url.trim()}
                  alt="Preview después"
                  className="block w-full"
                  style={{ maxHeight: 180, objectFit: "cover" }}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-zinc-500">
        Si dejas ambas columnas vacías, el bloque no se mostrará en la ficha.
      </p>
    </div>
  );
}
