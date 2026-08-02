import type { Json, Product } from "@/lib/supabase/types";
import { normalizeOptimizedImageUrl } from "@/lib/images/normalizeOptimizedImageUrl";

const CONTEXTS = [
  {
    sourceKeywords: ["arena", "sanitaria", "arenero"],
    targetKeywords: ["alfombra", "bolsa", "sanitaria", "spray", "antiolor"],
  },
  {
    sourceKeywords: ["snack", "catnip"],
    targetKeywords: ["plato", "comedero", "arena", "bolsa"],
  },
  {
    sourceKeywords: ["plato", "comedero"],
    targetKeywords: ["snack", "alimento"],
  },
] as const;

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

function buildBlob(p: Product) {
  return [p.name, p.category ?? "", ...(p.tags ?? [])].join(" ").toLowerCase();
}

export function pickProductUpsellSuggestions(
  currentProduct: Product,
  products: Product[],
  max = 2
): ProductUpsellSuggestion[] {
  const sourceBlob = buildBlob(currentProduct);
  const activeContext = CONTEXTS.find((c) => c.sourceKeywords.some((k) => sourceBlob.includes(k)));
  const contextKeywords = activeContext?.targetKeywords ?? [];

  // Sugerencias de productos relacionados (sin oferta): activo, con stock,
  // distinto al actual y sin variantes (no se pueden agregar en una sola unidad).
  const pool = products.filter(
    (p) =>
      p.active &&
      p.stock > 0 &&
      p.id !== currentProduct.id &&
      !p.has_variants
  );

  const scored = pool
    .map((p) => {
      const blob = buildBlob(p);
      const keywordScore = contextKeywords.reduce((acc, k) => acc + (blob.includes(k) ? 5 : 0), 0);
      const cheapScore = p.price <= 12000 ? 2 : p.price <= 25000 ? 1 : 0;
      return { p, score: keywordScore + cheapScore };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.p.price - b.p.price;
    });

  const out: ProductUpsellSuggestion[] = [];
  for (const { p } of scored) {
    if (out.length >= max) break;
    // Sin oferta: se sugiere y se agrega siempre a precio de lista.
    out.push({
      id: p.id,
      slug: p.slug,
      name: p.name,
      image: normalizeOptimizedImageUrl(p.images?.[0] ?? ""),
      price: p.price,
      offerPrice: p.price,
      discountPercent: 0,
      savings: 0,
      discount_enabled: p.discount_enabled === true,
      discount_max_percent: p.discount_max_percent ?? null,
      discount_steps: (Array.isArray(p.discount_steps) ? p.discount_steps : []) as Json,
    });
  }

  return out;
}
