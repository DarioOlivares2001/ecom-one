"use client";

import type { OfferCountdownData } from "@/lib/product/sections/types";
import { parseCountdownTarget } from "@/lib/product/sections/offerCountdown";
import { inputCls, labelCls, textareaCls } from "../shared";

interface OfferCountdownEditorProps {
  data: OfferCountdownData;
  onChange: (next: OfferCountdownData) => void;
}

/** ISO 8601 -> valor local para <input type="datetime-local"> (sin segundos/zona). */
function isoToLocalInputValue(iso: string): string {
  const date = parseCountdownTarget(iso);
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Valor de <input type="datetime-local"> (hora local del navegador) -> ISO 8601. */
function localInputValueToIso(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

export function OfferCountdownEditor({ data, onChange }: OfferCountdownEditorProps) {
  function patch(next: Partial<OfferCountdownData>) {
    onChange({ ...data, ...next });
  }

  const target = parseCountdownTarget(data.ends_at);
  const isPast = !!data.ends_at?.trim() && !target;
  const isExpired = !!target && target.getTime() <= Date.now();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Título de la sección (opcional)</label>
        <input
          className={inputCls}
          value={data.heading ?? ""}
          onChange={(e) => patch({ heading: e.target.value })}
          placeholder='Ej: "Oferta por tiempo limitado"'
          maxLength={80}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Mensaje (opcional)</label>
        <textarea
          className={textareaCls}
          rows={2}
          value={data.message ?? ""}
          onChange={(e) => patch({ message: e.target.value })}
          placeholder="Ej: Precio especial termina pronto."
          maxLength={140}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Fecha y hora de término</label>
        <input
          type="datetime-local"
          className={inputCls}
          value={isoToLocalInputValue(data.ends_at ?? "")}
          onChange={(e) => patch({ ends_at: localInputValueToIso(e.target.value) })}
        />
        <p className="text-[11px] text-zinc-500">
          Hora de tu navegador. Sin fecha, con fecha inválida o ya pasada, el contador no se
          muestra en la ficha — nunca un temporizador falso.
        </p>
        {isPast && (
          <p className="text-[11px] font-medium text-amber-700">
            La fecha guardada no es válida — el bloque no se mostrará hasta que definas una fecha
            correcta.
          </p>
        )}
        {isExpired && (
          <p className="text-[11px] font-medium text-amber-700">
            Esa fecha ya pasó — el bloque no se mostrará hasta que la actualices a una fecha
            futura.
          </p>
        )}
      </div>
    </div>
  );
}
