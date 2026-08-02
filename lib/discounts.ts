import type { Json } from "@/lib/supabase/types";
import { SHOW_VOLUME_DISCOUNTS } from "@/lib/config/features";

/** Paso de descuento por cantidad mínima en carrito (misma línea / producto). */
export type DiscountStep = {
  minQty: number;
  percent: number;
};

/** Subconjunto de producto necesario para calcular descuentos por volumen. */
export type ProductDiscountInput = {
  price: number;
  discount_enabled?: boolean | null;
  discount_max_percent?: number | null;
  discount_steps?: Json | unknown;
  discount_label?: string | null;
};

function clampPercent(n: number): number {
  if (!Number.isFinite(n) || Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/** discount_enabled estrictamente true. */
export function isDiscountEnabled(product: ProductDiscountInput): boolean {
  return product.discount_enabled === true;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/**
 * Parsea y normaliza steps: solo entradas válidas con minQty ≥ 2 (la 1ª unidad siempre a precio lista).
 * Ordenadas por minQty ascendente.
 */
export function normalizeDiscountSteps(steps: unknown): DiscountStep[] {
  if (!Array.isArray(steps)) return [];
  const out: DiscountStep[] = [];
  for (const row of steps) {
    if (!isRecord(row)) continue;
    const minRaw = row.minQty;
    const pctRaw = row.percent;
    const minQty = typeof minRaw === "number" ? minRaw : Number(minRaw);
    const percent = typeof pctRaw === "number" ? pctRaw : Number(pctRaw);
    if (!Number.isInteger(minQty) || minQty < 2) continue;
    if (!Number.isFinite(percent) || percent < 0 || Number.isNaN(percent)) continue;
    out.push({ minQty, percent });
  }
  out.sort((a, b) => a.minQty - b.minQty);
  return out;
}

/**
 * Etiqueta UX para la cantidad mínima de un escalón (orden ascendente como `normalizeDiscountSteps`).
 * Solo el último escalón usa "N+" (aplica desde N en adelante).
 */
export function formatDiscountTierMinQtyLabel(
  minQty: number,
  opts: { isLastTier: boolean; compact?: boolean }
): string {
  const compact = opts.compact === true;
  if (opts.isLastTier) {
    return compact ? `${minQty}+ u.` : `${minQty}+ unidades`;
  }
  return compact ? `${minQty} u.` : `${minQty} unidades`;
}

/** `true` si `minQty` es el último escalón del listado ya ordenado. */
export function isLastDiscountTier(steps: DiscountStep[], minQty: number): boolean {
  if (steps.length === 0) return false;
  return steps[steps.length - 1].minQty === minQty;
}

/**
 * Porcentaje aplicable (0–100) según cantidad y tope discount_max_percent.
 * Cantidad 1: siempre 0. Desde minQty 2 aplica el mayor step con quantity >= minQty.
 */
export function getApplicableProductDiscount(
  product: ProductDiscountInput,
  quantity: number
): number {
  if (!SHOW_VOLUME_DISCOUNTS) return 0;
  if (!isDiscountEnabled(product)) return 0;
  const steps = normalizeDiscountSteps(product.discount_steps);
  if (steps.length === 0) return 0;

  const qty = Math.floor(Number(quantity));
  const safeQty = Number.isFinite(qty) && !Number.isNaN(qty) ? Math.max(0, qty) : 0;
  if (safeQty < 2) return 0;

  let chosen: DiscountStep | null = null;
  for (const s of steps) {
    if (s.minQty < 2) continue;
    if (safeQty >= s.minQty) {
      if (!chosen || s.minQty > chosen.minQty) chosen = s;
    }
  }
  if (!chosen) return 0;

  const maxP = clampPercent(Number(product.discount_max_percent) || 0);
  const raw = Math.min(chosen.percent, maxP);
  return clampPercent(raw);
}

/**
 * Precio unitario en CLP (entero) tras descuento por cantidad.
 * Cantidad 1: precio lista (sin descuento). unitPrice opcional: p. ej. variante.
 */
export function getDiscountedUnitPrice(
  product: ProductDiscountInput,
  quantity: number,
  unitPrice?: number
): number {
  const base = unitPrice ?? product.price;
  const safeBase = Number.isFinite(base) && !Number.isNaN(base) ? Math.max(0, base) : 0;
  const pct = getApplicableProductDiscount(product, quantity);
  const factor = 1 - clampPercent(pct) / 100;
  const raw = safeBase * factor;
  const rounded = Math.round(raw);
  return Number.isFinite(rounded) && !Number.isNaN(rounded) ? rounded : 0;
}

/**
 * Próximo escalón aún no alcanzado (solo steps con minQty ≥ 2).
 */
export function getNextDiscountStep(
  product: ProductDiscountInput,
  quantity: number
): DiscountStep | null {
  if (!SHOW_VOLUME_DISCOUNTS) return null;
  if (!isDiscountEnabled(product)) return null;
  const steps = normalizeDiscountSteps(product.discount_steps);
  if (steps.length === 0) return null;

  const qty = Math.floor(Number(quantity));
  const safeQty = Number.isFinite(qty) && !Number.isNaN(qty) ? Math.max(0, qty) : 0;

  for (const s of steps) {
    if (s.minQty < 2) continue;
    if (safeQty < s.minQty) return s;
  }
  return null;
}
