import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductClient } from "./ProductClient";
import type { Product, ProductVariant, Review } from "@/lib/db/types";
import {
  getActiveProductBySlug,
  listActiveProductsExcluding,
  listActiveReviewsByProductId,
  listActiveVariantsByProductId,
} from "@/lib/db/repositories";
import { pickProductUpsellSuggestions } from "@/lib/product/upsell";
import { toPublicProduct } from "@/lib/product/toPublicProduct";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";
import { resolveStorefrontTheme } from "@/lib/store-settings/storefrontThemes";

interface Props {
  params: { slug: string };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─── Data fetching ────────────────────────────────────────────────────────────

/** Producto real desde Neon. No encontrado o error de conexión → null (404), nunca un producto ficticio. */
async function getProduct(slug: string): Promise<Product | null> {
  try {
    return await getActiveProductBySlug(slug);
  } catch (error) {
    console.error("[producto-detalle] error consultando producto:", error);
    return null;
  }
}

async function getProductVariants(productId: string): Promise<ProductVariant[]> {
  try {
    return await listActiveVariantsByProductId(productId);
  } catch {
    return [];
  }
}

async function getReviews(productId: string): Promise<Review[]> {
  try {
    const rows = await listActiveReviewsByProductId(productId);
    return rows.filter((r) => r.status === "approved");
  } catch {
    return [];
  }
}

async function getUpsellCandidates(excludeId: string): Promise<Product[]> {
  try {
    return await listActiveProductsExcluding(excludeId, 30);
  } catch (error) {
    console.error("[producto-detalle] error consultando upsells:", error);
    return [];
  }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct(params.slug);
  if (!product) return { title: "Producto no encontrado" };
  return {
    title: product.meta_title ?? product.name,
    description: product.meta_desc ?? product.description?.slice(0, 155) ?? undefined,
    openGraph: {
      title: product.name,
      description: product.meta_desc ?? undefined,
      images: product.images?.[0] ? [{ url: product.images[0] }] : [],
    },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProductPage({ params }: Props) {
  const product = await getProduct(params.slug);
  if (!product) notFound();

  const [reviews, variants, upsellCandidates, settings] = await Promise.all([
    getReviews(product.id),
    getProductVariants(product.id),
    getUpsellCandidates(product.id),
    getStoreSettings(),
  ]);
  const storefrontTheme = resolveStorefrontTheme(settings.storefront_theme);
  // Tema Bienestar: nunca completa "También te puede interesar" con
  // productos sin relación real (ni categoría ni tags en común) — se
  // prefiere ocultar la sección antes que mostrar algo no afín. Explícito
  // acá por tema, nunca implícito (ver PickUpsellOptions).
  const upsellSuggestions = pickProductUpsellSuggestions(product, upsellCandidates, 4, {
    allowGenericFallback: storefrontTheme !== "wellness-supplements",
  });

  return (
    <ProductClient
      product={toPublicProduct(product)}
      reviews={reviews}
      variants={variants}
      upsellSuggestions={upsellSuggestions}
      storefrontTheme={storefrontTheme}
    />
  );
}
