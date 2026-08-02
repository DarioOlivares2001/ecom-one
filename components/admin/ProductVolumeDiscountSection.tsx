"use client";

import { clsx } from "clsx";
import { Plus, X } from "lucide-react";
import {
  ADMIN_DEFAULT_LABEL,
  ADMIN_DEFAULT_MAX_PERCENT,
  ADMIN_DEFAULT_VOLUME_STEPS,
} from "@/lib/admin/productVolumeDiscounts";

const inputCls =
  "h-9 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]";

export type VolumeDiscountStepRow = { id: string; minQty: string; percent: string };

function newStepId() {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultVolumeDiscountStepRows(): VolumeDiscountStepRow[] {
  return ADMIN_DEFAULT_VOLUME_STEPS.map((s) => ({
    id: newStepId(),
    minQty: String(s.minQty),
    percent: String(s.percent),
  }));
}

type Props = {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  maxPercent: string;
  onMaxPercentChange: (v: string) => void;
  label: string;
  onLabelChange: (v: string) => void;
  steps: VolumeDiscountStepRow[];
  onStepsChange: (rows: VolumeDiscountStepRow[]) => void;
};

export function ProductVolumeDiscountSection({
  enabled,
  onEnabledChange,
  maxPercent,
  onMaxPercentChange,
  label,
  onLabelChange,
  steps,
  onStepsChange,
}: Props) {
  function applySuggestedTemplate() {
    onMaxPercentChange(String(ADMIN_DEFAULT_MAX_PERCENT));
    onLabelChange(ADMIN_DEFAULT_LABEL);
    onStepsChange(defaultVolumeDiscountStepRows());
  }

  function updateStep(id: string, key: "minQty" | "percent", value: string) {
    onStepsChange(steps.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  }

  function addStep() {
    onStepsChange([
      ...steps,
      { id: newStepId(), minQty: "2", percent: String(Math.min(Number(maxPercent) || 0, 5)) },
    ]);
  }

  function removeStep(id: string) {
    onStepsChange(steps.filter((r) => r.id !== id));
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-3.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Descuentos por cantidad
        </h2>
      </div>
      <div className="flex flex-col gap-4 p-5">
        <button
          type="button"
          onClick={() => onEnabledChange(!enabled)}
          className="flex items-center gap-3"
        >
          <div
            className={clsx(
              "relative h-6 w-11 rounded-full transition-colors duration-200",
              enabled ? "bg-zinc-900" : "bg-zinc-300"
            )}
          >
            <span
              className={clsx(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
                enabled ? "translate-x-5" : "translate-x-0.5"
              )}
            />
          </div>
          <span className="text-sm text-zinc-700">Activar descuentos por cantidad</span>
        </button>

        <p className="text-xs text-zinc-400">
          La primera unidad siempre va a precio lista. Los % aplican desde la cantidad mínima de cada
          escalón (≥ 2).
        </p>

        {enabled ? (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={applySuggestedTemplate}
                className="rounded-[var(--radius-sm)] border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
              >
                Usar plantilla sugerida (2–5 u., hasta 15%)
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Texto comercial (opcional)
              </label>
              <input
                type="text"
                className={inputCls}
                value={label}
                onChange={(e) => onLabelChange(e.target.value)}
                placeholder="Ej: Más unidades, mejor precio"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Descuento máximo permitido (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                className={clsx(inputCls, "max-w-[140px]")}
                value={maxPercent}
                onChange={(e) => onMaxPercentChange(e.target.value)}
              />
              <p className="mt-1 text-xs text-zinc-400">Tope 0–100. Ningún escalón puede superarlo.</p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-700">Escalones</span>
                <button
                  type="button"
                  onClick={addStep}
                  className="flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar escalón
                </button>
              </div>

              {steps.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                  Sin escalones. Usa la plantilla o agrega filas (cantidad mínima ≥ 2).
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-zinc-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        <th className="px-3 py-2">Cantidad mínima</th>
                        <th className="px-3 py-2">% descuento</th>
                        <th className="w-10 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 bg-white">
                      {steps.map((row) => (
                        <tr key={row.id}>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={2}
                              step={1}
                              className={clsx(inputCls, "h-8")}
                              value={row.minQty}
                              onChange={(e) => updateStep(row.id, "minQty", e.target.value)}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              className={clsx(inputCls, "h-8")}
                              value={row.percent}
                              onChange={(e) => updateStep(row.id, "percent", e.target.value)}
                            />
                          </td>
                          <td className="px-1 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeStep(row.id)}
                              className="inline-flex text-zinc-400 hover:text-red-500"
                              aria-label="Quitar escalón"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
