import type { Json, Product } from "@/lib/db/types";
import { isAllowedImageSrc } from "@/lib/images/isAllowedImageSrc";

export type ProductUpsellSuggestion = {
  id: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  offerPrice: number;
  discountPercent: number;
  savings: number;
  discount_enabled: boolean;
  discount_max_percent: number | null;
  discount_steps: Json;
};

/** Solo se usa si es de un host permitido (nunca una imagen rota, ej. *.supabase.co). */
function safeUpsellImage(url: string): string {
  return isAllowedImageSrc(url) ? url : "";
}

/**
 * Normaliza texto de catálogo (categoría, tags) para comparar de forma
 * tolerante a mayúsculas, espacios y acentos: "Aceites  " === "aceites" ===
 * "ACEITES" === "aceités" (variación simple de tildes).
 */
export function normalizeCatalogText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "");
}

function byCreatedAtDesc(a: Product, b: Product): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

/**
 * Sugiere productos relacionados en orden de relevancia real: misma
 * categoría primero, luego productos que comparten al menos un tag, y solo
 * si aún falta completar el cupo se usa cualquier otro producto activo como
 * relleno. Dentro de cada grupo, los más recientes van primero.
 */
export function pickProductUpsellSuggestions(
  currentProduct: Product,
  products: Product[],
  max = 4
): ProductUpsellSuggestion[] {
  const currentCategory = normalizeCatalogText(currentProduct.category ?? "");
  const currentTags = new Set((currentProduct.tags ?? []).map(normalizeCatalogText).filter(Boolean));

  // Activo, no eliminado, con stock, distinto al actual y sin variantes (no
  // se pueden agregar directo con el botón "Agregar" de la tarjeta).
  const pool = products.filter(
    (p) =>
      p.active &&
      p.deleted_at === null &&
      p.stock > 0 &&
      p.id !== currentProduct.id &&
      !p.has_variants
  );

  const sameCategory: Product[] = [];
  const sharesTag: Product[] = [];
  const rest: Product[] = [];

  for (const p of pool) {
    if (currentCategory && normalizeCatalogText(p.category ?? "") === currentCategory) {
      sameCategory.push(p);
      continue;
    }
    const hasSharedTag = currentTags.size > 0 && (p.tags ?? []).some((t) => currentTags.has(normalizeCatalogText(t)));
    if (hasSharedTag) {
      sharesTag.push(p);
      continue;
    }
    rest.push(p);
  }

  sameCategory.sort(byCreatedAtDesc);
  sharesTag.sort(byCreatedAtDesc);
  rest.sort(byCreatedAtDesc);

  const ranked = [...sameCategory, ...sharesTag, ...rest].slice(0, max);

  // Sin oferta: se sugiere y se agrega siempre a precio de lista. La imagen
  // real se pasa tal cual (sin sufijos artificiales tipo "-opt.webp"); si la
  // carga falla, la tarjeta muestra un placeholder (ver ProductClient).
  return ranked.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    image: safeUpsellImage(p.images?.[0] ?? ""),
    price: p.price,
    offerPrice: p.price,
    discountPercent: 0,
    savings: 0,
    discount_enabled: p.discount_enabled === true,
    discount_max_percent: p.discount_max_percent ?? null,
    discount_steps: (Array.isArray(p.discount_steps) ? p.discount_steps : []) as Json,
  }));
}
