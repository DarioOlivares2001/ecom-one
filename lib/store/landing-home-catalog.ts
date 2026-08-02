import type { BentoItem } from "@/components/store/BentoGrid";
import type { Product } from "@/lib/supabase/types";
import { normalizeProductCategory } from "@/lib/product/categories";

const MAX_INDIVIDUALS = 4;
const MAX_OFFERS = 6;

function isoNow(): string {
  return new Date().toISOString();
}

function makeProduct(p: Partial<Product> & Pick<Product, "id" | "slug" | "name" | "price" | "images" | "category">): Product {
  return {
    description: p.description ?? "",
    compare_at_price: p.compare_at_price ?? null,
    cost_price: p.cost_price ?? null,
    stock: p.stock ?? 99,
    tags: p.tags ?? [],
    variants: p.variants ?? null,
    has_variants: p.has_variants ?? false,
    options: p.options ?? null,
    meta_title: p.meta_title ?? null,
    meta_desc: p.meta_desc ?? null,
    active: p.active ?? true,
    deleted_at: p.deleted_at ?? null,
    created_at: p.created_at ?? isoNow(),
    updated_at: p.updated_at ?? isoNow(),
    ...p,
    discount_enabled: p.discount_enabled ?? false,
    discount_max_percent: p.discount_max_percent ?? 0,
    discount_steps: (Array.isArray(p.discount_steps) ? p.discount_steps : []) as Product["discount_steps"],
    discount_label: p.discount_label ?? null,
    product_sections: p.product_sections ?? ([] as Product["product_sections"]),
  };
}

/** Individuales cuando no hay BD o no hay coincidencias. No comparte IDs con los packs mock. */
export const LANDING_FALLBACK_INDIVIDUAL_PRODUCTS: Product[] = [
  makeProduct({
    id: "landing-fb-arena-clean-sand-plus",
    slug: "arena-clean-sand-plus",
    name: "Arena Clean Sand+",
    price: 24990,
    compare_at_price: null,
    images: [],
    category: "Arena para gatos",
  }),
  makeProduct({
    id: "landing-fb-alfombra-atrapa-arena",
    slug: "alfombra-atrapa-arena",
    name: "Alfombra atrapa arena",
    price: 14990,
    compare_at_price: 18990,
    images: [],
    category: "Limpieza y accesorios",
  }),
  makeProduct({
    id: "landing-fb-spray-antiolor",
    slug: "spray-antiolor",
    name: "Spray antiolor",
    price: 8990,
    compare_at_price: null,
    images: [],
    category: "Control de olores",
  }),
  makeProduct({
    id: "landing-fb-bolsas-arenero",
    slug: "bolsas-biodegradables-arenero",
    name: "Bolsas para arenero",
    price: 5990,
    compare_at_price: null,
    images: [],
    category: "Limpieza y accesorios",
  }),
];


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

export async function loadActiveProductsCatalog(): Promise<Product[]> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select(
        "id, slug, name, description, price, compare_at_price, cost_price, stock, images, category, tags, variants, has_variants, options, meta_title, meta_desc, active, created_at, updated_at"
      )
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(120);

    if (data?.length) return data as Product[];
  } catch {
    /* DB no configurada */
  }

  return [];
}

export async function resolveLandingBentoSections(): Promise<{
  starterItems: BentoItem[];
  offerProducts: Product[];
}> {
  const catalog = await loadActiveProductsCatalog();

  const startersFromDb =
    catalog.length > 0 ? pickIndividualStarters(catalog) : ([] as Product[]);

  const individualProducts =
    startersFromDb.length > 0
      ? startersFromDb
      : LANDING_FALLBACK_INDIVIDUAL_PRODUCTS.slice(0, MAX_INDIVIDUALS);

  const starterIds = new Set(individualProducts.map((p) => p.id));
  const offerProducts = catalog.length > 0 ? pickOfferProducts(catalog, starterIds) : [];

  return {
    starterItems: productsToLandingBentoItems(individualProducts),
    offerProducts,
  };
}
