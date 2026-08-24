import type { Product } from "@/lib/db/types";
import {
  getApplicableProductDiscount,
  getDiscountedUnitPrice,
  isDiscountEnabled,
  normalizeDiscountSteps,
} from "@/lib/discounts";
import { parseProductSectionsLoose, getVisibleSections } from "./parse";
import type { QuantityPacksData } from "./types";

export type ResolvedPackTier = {
  minQty: number;
  /** Nombre visible: el que puso el admin, o "x{minQty}" si lo dejó en blanco. */
  label: string;
  percent: number;
  unitPrice: number;
  totalPrice: number;
  savingsTotal: number;
  isMostChosen: boolean;
};

type PackPricingInput = Pick<
  Product,
  "price" | "discount_enabled" | "discount_max_percent" | "discount_steps"
>;

/**
 * Resuelve los escalones REALES (`discount_steps`) que el bloque referencia,
 * en el orden en que el admin los eligió. Si un `minQty` referenciado ya no
 * existe en los escalones reales del producto (el admin los cambió después),
 * se omite en silencio — nunca se inventa un escalón. El precio/ahorro se
 * calcula con las MISMAS funciones que usan el carrito y el checkout
 * (getApplicableProductDiscount/getDiscountedUnitPrice) — lo que se muestra
 * acá es exactamente lo que se cobrará, nunca un número aparte.
 */
export function resolvePackTiers(
  product: PackPricingInput,
  data: QuantityPacksData
): ResolvedPackTier[] {
  if (!isDiscountEnabled(product)) return [];

  const realSteps = normalizeDiscountSteps(product.discount_steps);
  if (realSteps.length === 0) return [];
  const realMinQtys = new Set(realSteps.map((s) => s.minQty));

  const price = Number.isFinite(product.price) ? Math.max(0, product.price) : 0;

  const out: ResolvedPackTier[] = [];
  for (const ref of data.steps) {
    if (!realMinQtys.has(ref.minQty)) continue;

    const percent = getApplicableProductDiscount(product, ref.minQty);
    const unitPrice = getDiscountedUnitPrice(product, ref.minQty, price);
    const totalPrice = unitPrice * ref.minQty;
    const savingsTotal = Math.max(0, price * ref.minQty - totalPrice);

    out.push({
      minQty: ref.minQty,
      label: ref.label?.trim() || `x${ref.minQty}`,
      percent,
      unitPrice,
      totalPrice,
      savingsTotal,
      isMostChosen: data.mostChosenMinQty === ref.minQty,
    });
  }
  return out;
}

/** `true` solo si hay al menos un pack real para mostrar (bloque habilitado + descuentos válidos). */
export function hasValidPackTiers(product: PackPricingInput, data: QuantityPacksData): boolean {
  return resolvePackTiers(product, data).length > 0;
}

/**
 * Busca, entre los bloques "Packs y ahorro" habilitados de la ficha, uno cuyo
 * escalón real coincida exactamente con `qty` — para que el CTA principal (y
 * el sticky) puedan mostrar "Agregar {label} al carrito". Devuelve `null` si
 * no hay ningún bloque de packs activo o si `qty` no coincide con ninguno.
 */
export function getActivePackLabel(product: Product, qty: number): string | null {
  const sections = getVisibleSections(parseProductSectionsLoose(product.product_sections));
  for (const section of sections) {
    if (section.type !== "quantity_packs") continue;
    const tier = resolvePackTiers(product, section.data).find((t) => t.minQty === qty);
    if (tier) return tier.label;
  }
  return null;
}
