import type { Metadata } from "next";
import { performance } from "node:perf_hooks";
import { MOCK_PRODUCTS } from "@/lib/utils/mock-products";
import { ProductsClient } from "./ProductsClient";
import type { Product } from "@/lib/db/types";
import { listActiveProducts } from "@/lib/db/repositories";

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
  let dbResponded = false;

  try {
    const queryStart = performance.now();
    const rows = await listActiveProducts();
    const queryMs = performance.now() - queryStart;
    dbResponded = true;

    if (perfEnabled()) {
      console.log(`${PERF_PREFIX} db query ms:`, Math.round(queryMs));
      console.log(`${PERF_PREFIX} products count:`, rows.length);
      console.log(`${PERF_PREFIX} payload approx bytes:`, approxPayloadBytes(rows));
    }

    if (rows.length) {
      return rows;
    }
  } catch {
    // DB not configured yet
  }

  if (perfEnabled() && !dbResponded) {
    console.log(`${PERF_PREFIX} db query ms: skipped (fallback mock)`);
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
