import type { Metadata } from "next";
import { performance } from "node:perf_hooks";
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

/** Catálogo real desde Neon. Base vacía o error de conexión → lista vacía (nunca datos ficticios). */
async function getProducts(): Promise<Product[]> {
  try {
    const queryStart = performance.now();
    const rows = await listActiveProducts();
    const queryMs = performance.now() - queryStart;

    if (perfEnabled()) {
      console.log(`${PERF_PREFIX} db query ms:`, Math.round(queryMs));
      console.log(`${PERF_PREFIX} products count:`, rows.length);
      console.log(`${PERF_PREFIX} payload approx bytes:`, approxPayloadBytes(rows));
    }

    return rows;
  } catch (error) {
    console.error(`${PERF_PREFIX} error consultando productos:`, error);
    return [];
  }
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
