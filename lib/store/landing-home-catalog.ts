import type { BentoItem } from "@/components/store/BentoGrid";
import type { Product } from "@/lib/db/types";
import { listActiveProducts } from "@/lib/db/repositories";
import { normalizeProductCategory, sortCategoriesForStore } from "@/lib/product/categories";
import { sanitizeImageUrls } from "@/lib/images/isAllowedImageSrc";

const MAX_FEATURED = 4;
const MAX_OFFERS = 6;

/** Hasta {MAX_FEATURED} productos activos con imagen, más recientes primero. */
export function pickFeaturedProducts(products: Product[]): Product[] {
  return products
    .filter((p) => !!p.images?.[0])
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, MAX_FEATURED);
}

export function pickOfferProducts(products: Product[], excludeIds: Set<string>): Product[] {
  return products
    .filter((p) => {
      if (excludeIds.has(p.id)) return false;
      if (!p.active) return false;
      if (!p.images?.[0]) return false;
      if (!p.compare_at_price || p.compare_at_price <= p.price) return false;
      return true;
    })
    .slice(0, MAX_OFFERS);
}

export function productToLandingBentoItem(p: Product, index: number): BentoItem {
  const hasOffer = !!p.compare_at_price && p.compare_at_price > p.price;
  return {
    id: p.id,
    type: index === 0 ? "featured" : "product",
    size: index === 0 || index === 3 ? "large" : "normal",
    title: p.name,
    subtitle: normalizeProductCategory(p.category) || undefined,
    price: p.price,
    compareAtPrice: hasOffer ? p.compare_at_price! : undefined,
    image: p.images?.[0] ?? undefined,
    href: `/productos/${p.slug}`,
    badge: p.stock === 0 ? "Agotado" : p.stock <= 5 ? "Últimas unidades" : undefined,
  };
}

export function productsToLandingBentoItems(products: Product[]): BentoItem[] {
  return products.map(productToLandingBentoItem);
}

/**
 * Catálogo real desde Neon. Base vacía o error de conexión → lista vacía
 * (nunca datos ficticios). Las URLs de imagen se filtran a solo hosts
 * permitidos (R2 configurado / local) para que un registro con una URL vieja
 * de `*.supabase.co` u otro host no soportado nunca llegue a `next/image`.
 */
export async function loadActiveProductsCatalog(): Promise<Product[]> {
  try {
    const rows = await listActiveProducts({ limit: 120 });
    return rows.map((p) => ({ ...p, images: sanitizeImageUrls(p.images) }));
  } catch (error) {
    console.error("[landing-home-catalog] error consultando catálogo:", error);
    return [];
  }
}

/** Categorías reales del catálogo activo, sin lista fija en código. */
export function pickStoreCategories(products: Product[]): string[] {
  const unique = Array.from(
    new Set(products.map((p) => normalizeProductCategory(p.category)).filter(Boolean))
  );
  return sortCategoriesForStore(unique);
}

export async function resolveLandingBentoSections(): Promise<{
  starterItems: BentoItem[];
  offerProducts: Product[];
  categories: string[];
}> {
  const catalog = await loadActiveProductsCatalog();

  const featuredProducts = pickFeaturedProducts(catalog);
  const starterIds = new Set(featuredProducts.map((p) => p.id));
  const offerProducts = pickOfferProducts(catalog, starterIds);
  const categories = pickStoreCategories(catalog);

  return {
    starterItems: productsToLandingBentoItems(featuredProducts),
    offerProducts,
    categories,
  };
}
