import type { Json } from "@/lib/supabase/types";

/** Escalón persistido en `products.discount_steps` (JSON). */
export type AdminDiscountStep = { minQty: number; percent: number };

export const ADMIN_DEFAULT_VOLUME_STEPS: AdminDiscountStep[] = [
  { minQty: 2, percent: 5 },
  { minQty: 3, percent: 10 },
  { minQty: 4, percent: 12 },
  { minQty: 5, percent: 15 },
];

export const ADMIN_DEFAULT_MAX_PERCENT = 15;
export const ADMIN_DEFAULT_LABEL = "Más unidades, mejor precio";

export type ParsedVolumeDiscountFields = {
  discount_enabled: boolean;
  discount_max_percent: number;
  discount_steps: AdminDiscountStep[];
  discount_label: string | null;
};

function roundPercent(n: number): number {
  if (!Number.isFinite(n)) return NaN;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * Valida y normaliza descuentos por volumen para persistir.
 * Si `enabled` es false, devuelve siempre campos “apagados”.
 */
export function validateVolumeDiscountForSave(
  enabled: boolean,
  maxPercentRaw: number,
  labelTrimmed: string | null,
  stepsInput: AdminDiscountStep[]
): { ok: true; data: ParsedVolumeDiscountFields } | { ok: false; error: string } {
  if (!enabled) {
    return {
      ok: true,
      data: {
        discount_enabled: false,
        discount_max_percent: 0,
        discount_steps: [],
        discount_label: null,
      },
    };
  }

  if (!Number.isFinite(maxPercentRaw) || maxPercentRaw < 0 || maxPercentRaw > 100) {
    return { ok: false, error: "El descuento máximo debe estar entre 0 y 100." };
  }
  const maxPercent = roundPercent(maxPercentRaw);

  if (stepsInput.length === 0) {
    return {
      ok: false,
      error: "Con descuentos activados, define al menos un escalón (cantidad mínima ≥ 2).",
    };
  }

  const sorted = [...stepsInput].sort((a, b) => a.minQty - b.minQty);
  const seenMin = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    if (!Number.isInteger(s.minQty) || s.minQty < 2) {
      return {
        ok: false,
        error: `Escalón ${i + 1}: la cantidad mínima debe ser un entero ≥ 2 (no se permite 1).`,
      };
    }
    const pct = roundPercent(s.percent);
    if (!Number.isFinite(s.percent) || s.percent < 0) {
      return { ok: false, error: `Escalón ${i + 1}: el porcentaje no puede ser negativo.` };
    }
    if (pct > maxPercent) {
      return {
        ok: false,
        error: `Escalón ${i + 1}: el porcentaje no puede superar el tope (${maxPercent}%).`,
      };
    }
    if (seenMin.has(s.minQty)) {
      return { ok: false, error: `Cantidad mínima duplicada: ${s.minQty}.` };
    }
    seenMin.add(s.minQty);
  }

  const normalizedSteps = sorted.map((s) => ({
    minQty: s.minQty,
    percent: roundPercent(s.percent),
  }));

  return {
    ok: true,
    data: {
      discount_enabled: true,
      discount_max_percent: maxPercent,
      discount_steps: normalizedSteps,
      discount_label: labelTrimmed && labelTrimmed.length > 0 ? labelTrimmed : null,
    },
  };
}

function parseStepsFromJson(raw: string | null): AdminDiscountStep[] | { error: string } {
  if (raw == null || raw.trim() === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "El JSON de escalones no es válido." };
  }
  if (!Array.isArray(parsed)) {
    return { error: "Los escalones deben ser un arreglo JSON." };
  }
  const out: AdminDiscountStep[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return { error: `Escalón ${i + 1}: formato inválido.` };
    }
    const o = row as Record<string, unknown>;
    const minQty = typeof o.minQty === "number" ? o.minQty : Number(o.minQty);
    const percent = typeof o.percent === "number" ? o.percent : Number(o.percent);
    out.push({ minQty, percent });
  }
  return out;
}

/** Lee y valida descuentos por volumen desde `FormData` (server actions). */
export function parseVolumeDiscountFromFormData(
  formData: FormData
): { ok: true; data: ParsedVolumeDiscountFields } | { ok: false; error: string } {
  const enabled = formData.get("discount_enabled") === "true";
  if (!enabled) {
    return {
      ok: true,
      data: {
        discount_enabled: false,
        discount_max_percent: 0,
        discount_steps: [],
        discount_label: null,
      },
    };
  }

  const maxRaw = formData.get("discount_max_percent");
  const maxNum = maxRaw === null || String(maxRaw).trim() === "" ? NaN : Number(maxRaw);
  const labelRaw = (formData.get("discount_label") as string | null) ?? "";
  const label = labelRaw.trim() === "" ? null : labelRaw.trim();

  const stepsParsed = parseStepsFromJson(formData.get("discount_steps_json") as string | null);
  if (!Array.isArray(stepsParsed)) {
    return { ok: false, error: stepsParsed.error };
  }

  return validateVolumeDiscountForSave(enabled, maxNum, label, stepsParsed);
}

/** Convierte filas del formulario admin a números (submit cliente → misma validación que el servidor). */
export function volumeDiscountFormRowsToSteps(
  rows: { minQty: string; percent: string }[]
): AdminDiscountStep[] {
  return rows.map((r) => ({
    minQty: Number(String(r.minQty).trim()),
    percent: Number(String(r.percent).trim()),
  }));
}

export function volumeDiscountToJsonFields(data: ParsedVolumeDiscountFields): {
  discount_enabled: boolean;
  discount_max_percent: number;
  discount_steps: Json;
  discount_label: string | null;
} {
  return {
    discount_enabled: data.discount_enabled,
    discount_max_percent: data.discount_max_percent,
    discount_steps: data.discount_steps as unknown as Json,
    discount_label: data.discount_label,
  };
}
