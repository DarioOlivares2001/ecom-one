/**
 * Porcentaje y referencia de precio para upsells en carrito (solo UI).
 * No altera precios cobrados ni lógica de `add`.
 */

function finitePositive(n: unknown): number | null {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x) || x <= 0) return null;
  return x;
}

/**
 * Precio "antes" para calcular % OFF: `compare_at_price` si es mayor que lista y que la oferta; si no, precio lista.
 */
export function resolveUpsellReferencePrice(params: {
  listPrice: number;
  compareAtPrice?: number | null;
  offerPrice: number;
}): number {
  const list = finitePositive(params.listPrice) ?? 0;
  const offerRaw = finitePositive(params.offerPrice);
  const offer = offerRaw !== null ? offerRaw : list;
  const c = finitePositive(params.compareAtPrice);
  if (c !== null && c > list && c > offer) return c;
  return list;
}

/**
 * % redondeado entre 0 y 100. Si `discountPercentHint` es válido y coincide con el cálculo (±1), se usa el hint.
 */
export function computeUpsellDiscountPercentFromPrices(params: {
  listPrice: number;
  compareAtPrice?: number | null;
  offerPrice: number;
  discountPercentHint?: number | null;
  /** Tope comercial (p. ej. `discount_max_percent`); acota el % mostrado vs referencia. */
  displayPercentCap?: number | null;
}): number {
  const list = finitePositive(params.listPrice) ?? 0;
  const offer = finitePositive(params.offerPrice) ?? list;
  const original = resolveUpsellReferencePrice({
    listPrice: list,
    compareAtPrice: params.compareAtPrice,
    offerPrice: offer,
  });
  if (original <= 0 || offer >= original) return 0;
  const raw = ((original - offer) / original) * 100;
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const computed = Math.round(raw);
  if (!Number.isFinite(computed) || computed < 1 || computed > 100) return 0;

  const hintRaw = params.discountPercentHint;
  const hint =
    typeof hintRaw === "number" && Number.isFinite(hintRaw) ? Math.round(hintRaw) : null;
  if (hint !== null && hint > 0 && hint <= 100 && Math.abs(hint - computed) <= 1) {
    return applyDisplayCap(hint, params.displayPercentCap);
  }
  return applyDisplayCap(computed, params.displayPercentCap);
}

function applyDisplayCap(value: number, cap: number | null | undefined): number {
  if (typeof cap !== "number" || !Number.isFinite(cap) || cap < 0) return value;
  const c = Math.min(100, Math.round(cap));
  return Math.min(value, c);
}

export function computeUpsellSavingsDisplay(
  listPrice: number,
  compareAtPrice: number | null | undefined,
  offerPrice: number
): number {
  const list = finitePositive(listPrice) ?? 0;
  const offer = finitePositive(offerPrice) ?? list;
  const ref = resolveUpsellReferencePrice({ listPrice: list, compareAtPrice, offerPrice: offer });
  return Math.max(0, Math.round(ref - offer));
}
