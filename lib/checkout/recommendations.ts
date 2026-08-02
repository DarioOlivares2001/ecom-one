import { normalizeOptimizedImageUrl } from "@/lib/images/normalizeOptimizedImageUrl";
import type { Json } from "@/lib/supabase/types";

/** Margen mínimo de seguridad: si la oferta deja menos de esto, se anula el descuento. */
const MIN_MARGIN_PCT = 0.25;

/**
 * % inicial del motor de UPSELLS (no del descuento por cantidad).
 * Reglas:
 *  - Se aplica solo a productos con `discount_enabled === true`.
 *  - Se acota por `discount_max_percent`: `min(UPSELL_BASE_PERCENT, max)`.
 *  - NO escala con la cantidad; cada línea con `source: "upsell"` mantiene este %.
 */
export const UPSELL_BASE_PERCENT = 5;

/** Calcula el % de upsell efectivo: `min(UPSELL_BASE_PERCENT, discount_max_percent)`. */
export function computeUpsellAppliedPercent(
  discountMaxPercent: number | null | undefined
): number {
  const cap = Math.min(
    100,
    Math.max(0, Math.round(Number(discountMaxPercent) || 0))
  );
  if (cap <= 0) return 0;
  return Math.min(UPSELL_BASE_PERCENT, cap);
}

const CONTEXT_RULES = [
  {
    id: "litter",
    cartKeywords: ["arena", "arenero", "sanitaria"],
    recommendKeywords: ["alfombra", "bolsa", "sanitaria", "spray", "antiolor", "arenero"],
    title: "Completa la limpieza de tu gato 🐾",
  },
  {
    id: "snack",
    cartKeywords: ["snack", "catnip", "galleta"],
    recommendKeywords: ["plato", "comedero", "juguete", "arena", "bolsa"],
    title: "Haz más feliz a tu michi 😸",
  },
  {
    id: "bowl",
    cartKeywords: ["plato", "comedero"],
    recommendKeywords: ["snack", "alimento", "bolsa"],
    title: "Combina perfecto con snacks 🐟",
  },
] as const;

export const FALLBACK_RECOMMENDATION_TITLE = "Antes de pagar, muchos agregan esto";

export type CheckoutRecRow = {
  id: string;
  slug: string;
  name: string;
  price: number;
  compare_at_price?: number | null;
  cost_price?: number | null;
  images: string[];
  stock: number;
  category: string | null;
  tags: string[] | null;
  /** Si es true, se excluye del checkout rápido (requiere elegir variante). */
  has_variants?: boolean | null;
  discount_enabled?: boolean | null;
  discount_max_percent?: number | null;
  discount_steps?: unknown;
};

export type CheckoutRecProduct = Pick<
  CheckoutRecRow,
  "id" | "slug" | "name" | "price" | "images" | "compare_at_price"
> & {
  offerPrice?: number;
  discountPercent?: number;
  savings?: number;
  discount_enabled?: boolean;
  discount_max_percent?: number | null;
  discount_steps?: Json;
};

export function getRecommendationContext(cartProductNames: string[]): {
  title: string;
  recommendKeywords: string[] | null;
} {
  const cartBlob = cartProductNames.join(" ").toLowerCase();
  for (const rule of CONTEXT_RULES) {
    if (rule.cartKeywords.some((k) => cartBlob.includes(k))) {
      return { title: rule.title, recommendKeywords: [...rule.recommendKeywords] };
    }
  }
  return { title: FALLBACK_RECOMMENDATION_TITLE, recommendKeywords: null };
}

function scoreByContextKeywords(product: CheckoutRecRow, keywords: string[] | null): number {
  if (!keywords || keywords.length === 0) return 0;
  const blob = [product.name, product.category ?? "", ...(product.tags ?? [])]
    .join(" ")
    .toLowerCase();
  return keywords.reduce((acc, k) => acc + (blob.includes(k) ? 4 : 0), 0);
}

function scoreGenericComplementary(product: CheckoutRecRow): number {
  const blob = [product.name, product.category ?? "", ...(product.tags ?? [])]
    .join(" ")
    .toLowerCase();
  const genericHints = ["bolsa", "snack", "juguete", "arena", "comedero", "accesorio"];
  return genericHints.reduce((acc, k) => acc + (blob.includes(k) ? 1 : 0), 0);
}

/**
 * Motor de UPSELLS (descuento inicial fijo, independiente de cantidad):
 *   - Requiere `discount_enabled === true` y `discount_max_percent > 0`.
 *   - El % aplicado es `min(UPSELL_BASE_PERCENT, discount_max_percent)`.
 *     Ej: max=15 ⇒ 5%; max=3 ⇒ 3%; max=0 ⇒ no aparece.
 *   - Se anula si el precio resultante deja menos margen que `MIN_MARGIN_PCT`
 *     frente al `cost_price` (cuando hay).
 *
 * Esta función NO se usa para cobrar descuentos por cantidad (eso sigue siendo
 * step-based desde `discount_steps`).
 */
function safeDiscount(
  price: number,
  costPrice: number | null | undefined,
  product: Pick<CheckoutRecRow, "discount_enabled" | "discount_max_percent">
): { offerPrice: number; discountPercent: number; savings: number } | null {
  if (product.discount_enabled !== true) return null;
  if (!(price > 0)) return null;

  const upsellPct = computeUpsellAppliedPercent(product.discount_max_percent);
  if (upsellPct <= 0) return null;

  const offerPrice = Math.round(price * (1 - upsellPct / 100));
  if (costPrice && costPrice > 0) {
    if (offerPrice <= costPrice) return null;
    const marginPct = (offerPrice - costPrice) / offerPrice;
    if (marginPct < MIN_MARGIN_PCT) return null;
  }
  return { offerPrice, discountPercent: upsellPct, savings: price - offerPrice };
}

/**
 * Upsell: anuncia el tope `discount_max_percent` como % de oferta.
 * Devuelve null si el producto no está habilitado o el margen lo invalida.
 */
export function computeSafeUpsellDiscountFromProduct(
  price: number,
  costPrice: number | null | undefined,
  product: Pick<CheckoutRecRow, "discount_enabled" | "discount_max_percent">
): { offerPrice: number; discountPercent: number; savings: number } | null {
  return safeDiscount(price, costPrice, product);
}

/**
 * Elige hasta `max` productos: excluye carrito, aplica contexto inteligente
 * y usa descuento seguro si `cost_price` lo permite.
 */
export function pickCheckoutRecommendations(
  rows: CheckoutRecRow[],
  excludeProductIds: string[],
  cartProductNames: string[],
  max = 2
): { title: string; products: CheckoutRecProduct[] } {
  const ex = new Set(excludeProductIds);
  const { title, recommendKeywords } = getRecommendationContext(cartProductNames);
  // Solo entran al "pool de ofertas" productos con descuento habilitado y tope > 0.
  // discount_max_percent es TOPE, no descuento aplicado; el % real lo decide safeDiscount.
  const pool = rows.filter(
    (p) =>
      !ex.has(p.id) &&
      p.stock > 0 &&
      p.has_variants !== true &&
      p.discount_enabled === true &&
      Number(p.discount_max_percent) > 0
  );

  const scored = pool
    .map((p) => ({
      p,
      score: scoreByContextKeywords(p, recommendKeywords) + scoreGenericComplementary(p),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.p.stock - a.p.stock;
    });

  const picked: CheckoutRecProduct[] = [];
  const seen = new Set<string>();

  function toProduct(p: CheckoutRecRow): CheckoutRecProduct {
    // El % anunciado del upsell es el tope `discount_max_percent` (no step-based).
    const safe = safeDiscount(p.price, p.cost_price, p);
    const offerPrice = safe?.offerPrice ?? p.price;
    const discountPercent = safe?.discountPercent ?? 0;
    const savings = safe?.savings ?? 0;
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      price: p.price,
      compare_at_price: p.compare_at_price ?? null,
      images: (Array.isArray(p.images) ? p.images : []).map((img) =>
        normalizeOptimizedImageUrl(String(img ?? ""))
      ),
      offerPrice,
      discountPercent,
      savings,
      discount_enabled: p.discount_enabled === true,
      discount_max_percent: p.discount_max_percent ?? null,
      discount_steps: (Array.isArray(p.discount_steps) ? p.discount_steps : []) as Json,
    };
  }

  for (const { p } of scored) {
    if (picked.length >= max) break;
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    picked.push(toProduct(p));
  }

  if (picked.length < max) {
    const rest = pool
      .filter((p) => !seen.has(p.id))
      .sort((a, b) => b.stock - a.stock);
    for (const p of rest) {
      if (picked.length >= max) break;
      seen.add(p.id);
      picked.push(toProduct(p));
    }
  }

  return { title, products: picked.slice(0, max) };
}
