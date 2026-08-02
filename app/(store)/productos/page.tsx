import type { Metadata } from "next";
import { performance } from "node:perf_hooks";
import { MOCK_PRODUCTS } from "@/lib/utils/mock-products";
import { ProductsClient } from "./ProductsClient";
import type { Product } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Productos",
  description: "Explora nuestro catálogo completo.",
};

const PERF_PREFIX = "[perf-products]";

function perfEnabled(): boolean {
  return process.env.NODE_ENV !== "test";
}

function approxPayloadBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

async function getProducts(): Promise<Product[]> {
  let supabaseResponded = false;

  try {
    const queryStart = performance.now();
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select(
        "id, slug, name, price, compare_at_price, stock, images, category, active, created_at, has_variants, variants, discount_enabled, discount_max_percent, discount_steps, discount_label"
      )
      .eq("active", true)
      .order("created_at", { ascending: false });
    const queryMs = performance.now() - queryStart;
    supabaseResponded = true;

    const rows = Array.isArray(data) ? (data as unknown[]) : [];
    if (perfEnabled()) {
      console.log(`${PERF_PREFIX} supabase query ms:`, Math.round(queryMs));
      console.log(`${PERF_PREFIX} products count:`, rows.length);
      console.log(`${PERF_PREFIX} payload approx bytes:`, approxPayloadBytes(rows));
    }

    if (data?.length) {
      return data as Product[];
    }
  } catch {
    // DB not configured yet
  }

  if (perfEnabled() && !supabaseResponded) {
    console.log(`${PERF_PREFIX} supabase query ms: skipped (fallback mock)`);
    console.log(`${PERF_PREFIX} products count:`, MOCK_PRODUCTS.length);
    console.log(`${PERF_PREFIX} payload approx bytes:`, approxPayloadBytes(MOCK_PRODUCTS));
  }

  return MOCK_PRODUCTS;
}

export default async function ProductosPage() {
  const renderStart = performance.now();
  const products = await getProducts();
  if (perfEnabled()) {
    const totalMs = performance.now() - renderStart;
    console.log(`${PERF_PREFIX} total server ms:`, Math.round(totalMs));
  }

  return <ProductsClient initialProducts={products} />;
}
