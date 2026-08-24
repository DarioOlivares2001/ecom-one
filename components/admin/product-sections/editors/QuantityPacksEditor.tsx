"use client";

import { Star } from "lucide-react";
import { clsx } from "clsx";
import type { QuantityPacksData } from "@/lib/product/sections/types";
import type { AdminDiscountStep } from "@/lib/admin/productVolumeDiscounts";
import { inputCls, labelCls, textareaCls } from "../shared";

interface QuantityPacksEditorProps {
  data: QuantityPacksData;
  onChange: (next: QuantityPacksData) => void;
  /** Estado actual (sin guardar todavía) de la sección "Descuentos por volumen" del mismo formulario. */
  discountEnabled: boolean;
  discountSteps: AdminDiscountStep[];
}

export function QuantityPacksEditor({
  data,
  onChange,
  discountEnabled,
  discountSteps,
}: QuantityPacksEditorProps) {
  function patch(next: Partial<QuantityPacksData>) {
    onChange({ ...data, ...next });
  }

  const selectedByMinQty = new Map(data.steps.map((s) => [s.minQty, s]));

  function toggleStep(minQty: number, checked: boolean) {
    if (checked) {
      if (data.steps.some((s) => s.minQty === minQty)) return;
      patch({ steps: [...data.steps, { minQty }] });
    } else {
      const nextSteps = data.steps.filter((s) => s.minQty !== minQty);
      patch({
        steps: nextSteps,
        mostChosenMinQty: data.mostChosenMinQty === minQty ? null : data.mostChosenMinQty,
      });
    }
  }

  function updateStepLabel(minQty: number, label: string) {
    patch({
      steps: data.steps.map((s) => (s.minQty === minQty ? { ...s, label } : s)),
    });
  }

  function toggleMostChosen(minQty: number) {
    patch({ mostChosenMinQty: data.mostChosenMinQty === minQty ? null : minQty });
  }

  const noRealDiscounts = !discountEnabled || discountSteps.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Título de la sección (opcional)</label>
        <input
          className={inputCls}
          value={data.heading ?? ""}
          onChange={(e) => patch({ heading: e.target.value })}
          placeholder='Ej: "Packs y ahorro"'
          maxLength={80}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Texto breve (opcional)</label>
        <textarea
          className={textareaCls}
          rows={2}
          value={data.description ?? ""}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="Ej: Elige la cantidad que más te conviene."
          maxLength={240}
        />
      </div>

      {noRealDiscounts ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          Este producto todavía no tiene <strong>descuentos por volumen</strong> activados o sin
          escalones. Actívalos y define al menos un escalón en la sección &quot;Descuentos por
          volumen&quot; de este mismo formulario para poder elegir qué packs mostrar acá. Mientras
          tanto, este bloque no se mostrará en la ficha aunque esté activo.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <span className={labelCls}>Escalones reales a mostrar como pack</span>
          <div className="flex flex-col gap-2">
            {discountSteps.map((step) => {
              const selected = selectedByMinQty.get(step.minQty);
              const checked = !!selected;
              return (
                <div
                  key={step.minQty}
                  className={clsx(
                    "rounded-lg border px-3 py-2.5 transition-colors",
                    checked ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-zinc-800">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleStep(step.minQty, e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                      />
                      {step.minQty} unidades · {step.percent}% OFF
                    </label>
                    {checked && (
                      <button
                        type="button"
                        onClick={() => toggleMostChosen(step.minQty)}
                        className={clsx(
                          "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors",
                          data.mostChosenMinQty === step.minQty
                            ? "bg-amber-400 text-amber-950"
                            : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                        )}
                        aria-pressed={data.mostChosenMinQty === step.minQty}
                      >
                        <Star className="h-3 w-3" />
                        Más elegido
                      </button>
                    )}
                  </div>
                  {checked && (
                    <div className="mt-2 flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-zinc-500">
                        Nombre del pack (opcional — si lo dejas vacío se muestra &quot;x{step.minQty}&quot;)
                      </label>
                      <input
                        className={inputCls}
                        value={selected?.label ?? ""}
                        onChange={(e) => updateStepLabel(step.minQty, e.target.value)}
                        placeholder={`Ej: "Pack x${step.minQty}"`}
                        maxLength={40}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-zinc-500">
            Como máximo un pack puede marcarse &quot;Más elegido&quot; — nunca se infiere solo.
          </p>
        </div>
      )}
    </div>
  );
}
