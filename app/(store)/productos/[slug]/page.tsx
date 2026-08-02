import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductClient } from "./ProductClient";
import { getMockProduct, MOCK_PRODUCTS } from "@/lib/utils/mock-products";
import type { Product, ProductVariant, Review } from "@/lib/db/types";
import {
  getActiveProductBySlug,
  listActiveProductsExcluding,
  listActiveReviewsByProductId,
  listActiveVariantsByProductId,
} from "@/lib/db/repositories";
import { pickProductUpsellSuggestions } from "@/lib/product/upsell";

interface Props {
  params: { slug: string };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getProduct(slug: string): Promise<Product | null> {
  try {
    const product = await getActiveProductBySlug(slug);
    if (product) return product;
  } catch {
    // DB not configured yet
  }
  return getMockProduct(slug);
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
    const candidates = await listActiveProductsExcluding(excludeId, 30);
    if (candidates.length) return candidates;
  } catch {
    // DB not configured yet
  }
  return MOCK_PRODUCTS.filter((p) => p.id !== excludeId && p.active && p.stock > 0);
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

  const [reviews, variants, upsellCandidates] = await Promise.all([
    getReviews(product.id),
    getProductVariants(product.id),
    getUpsellCandidates(product.id),
  ]);
  const upsellSuggestions = pickProductUpsellSuggestions(product, upsellCandidates, 6);

  return (
    <ProductClient
      product={product}
      reviews={reviews}
      variants={variants}
      upsellSuggestions={upsellSuggestions}
    />
  );
}
