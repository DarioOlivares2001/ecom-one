import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductClient } from "./ProductClient";
import { getMockProduct, MOCK_PRODUCTS } from "@/lib/utils/mock-products";
import type { Database, Product, Review } from "@/lib/supabase/types";
import { pickProductUpsellSuggestions } from "@/lib/product/upsell";

interface Props {
  params: { slug: string };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProductVariant = Database["public"]["Tables"]["product_variants"]["Row"];

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getProduct(slug: string): Promise<Product | null> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("slug", slug)
      .eq("active", true)
      .single();
    if (data) return data as Product;
  } catch {
    // DB not configured yet
  }
  return getMockProduct(slug);
}

async function getProductVariants(productId: string): Promise<ProductVariant[]> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = createClient();
    const { data } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .eq("active", true)
      .order("position", { ascending: true });
    return (data ?? []) as ProductVariant[];
  } catch {
    return [];
  }
}

async function getReviews(productId: string): Promise<Review[]> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = createClient();
    const { data } = await supabase
      .from("reviews")
      .select("*")
      .eq("product_id", productId)
      .eq("active", true)
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    return (data ?? []) as Review[];
  } catch {
    return [];
  }
}

async function getUpsellCandidates(excludeId: string): Promise<Product[]> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .gt("stock", 0)
      .neq("id", excludeId)
      .limit(30);
    if (data?.length) return data as Product[];
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
