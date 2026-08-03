import type { BentoItem } from "@/components/store/BentoGrid";
import type { Product } from "@/lib/db/types";
import { listActiveProducts } from "@/lib/db/repositories";
import { normalizeProductCategory } from "@/lib/product/categories";
import { sanitizeImageUrls } from "@/lib/images/isAllowedImageSrc";

const MAX_INDIVIDUALS = 4;
const MAX_OFFERS = 6;

export function isExcludedSnackOrPackIndividual(p: Product): boolean {
  const c = normalizeProductCategory(p.category);
  if (c === "Packs ahorro" || c === "Snacks y premios") return true;
  const nameTrim = p.name.trim();
  if (/^pack[\s_-]/i.test(nameTrim) || /\bpack\s+(control|ahorro|limpieza|combo)/i.test(p.name))
    return true;
  return false;
}

function matchesCleanSandPlus(p: Product): boolean {
  const s = `${p.slug} ${p.name}`.toLowerCase();
  return (
    /clean\s*sand|clean\+|sand\+|sand\s*plus/i.test(s) ||
    (/arena\s*clean/i.test(s) && !/alfombra|spray|pack/i.test(s))
  );
}

function matchesAlfombraAtrapaArena(p: Product): boolean {
  const s = `${p.slug} ${p.name}`.toLowerCase();
  return /alfombra|atrapa[\s_-]*arena/.test(s);
}

function matchesSprayAntiolor(p: Product): boolean {
  const s = `${p.slug} ${p.name}`.toLowerCase();
  return /spray|anti\s*olor|antiolor/.test(s);
}

/** Hasta {MAX_INDIVIDUALS} SKUs individuales: arena principal, alfombra, spray, refuerzos de categorías permitidas. */
export function pickIndividualStarters(products: Product[]): Product[] {
  const pool = products.filter((p) => !isExcludedSnackOrPackIndividual(p));
  const picked: Product[] = [];
  const ids = new Set<string>();

  function take(predicate: (p: Product) => boolean) {
    for (const p of pool) {
      if (picked.length >= MAX_INDIVIDUALS) return;
      if (ids.has(p.id)) continue;
      if (!predicate(p)) continue;
      picked.push(p);
      ids.add(p.id);
    }
  }

  take(matchesCleanSandPlus);
  take(matchesAlfombraAtrapaArena);
  take(matchesSprayAntiolor);

  if (picked.length < MAX_INDIVIDUALS) {
    const preferredCategories = new Set([
      "Arena para gatos",
      "Control de olores",
      "Limpieza y accesorios",
      "Areneros",
    ]);
    const extras = pool.filter((p) => !ids.has(p.id) && preferredCategories.has(normalizeProductCategory(p.category)));
    for (const p of extras) {
      if (picked.length >= MAX_INDIVIDUALS) break;
      picked.push(p);
      ids.add(p.id);
    }
  }

  if (picked.length < MAX_INDIVIDUALS) {
    for (const p of pool) {
      if (picked.length >= MAX_INDIVIDUALS) break;
      if (ids.has(p.id)) continue;
      picked.push(p);
      ids.add(p.id);
    }
  }

  return picked.slice(0, MAX_INDIVIDUALS);
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

export async function resolveLandingBentoSections(): Promise<{
  starterItems: BentoItem[];
  offerProducts: Product[];
}> {
  const catalog = await loadActiveProductsCatalog();

  const individualProducts = pickIndividualStarters(catalog);
  const starterIds = new Set(individualProducts.map((p) => p.id));
  const offerProducts = pickOfferProducts(catalog, starterIds);

  return {
    starterItems: productsToLandingBentoItems(individualProducts),
    offerProducts,
  };
}
