import type { Product } from "@/lib/db/types";

/**
 * Redacta campos de uso exclusivo del admin antes de pasar un producto a un
 * componente "use client" del storefront (catálogo, ficha). Next.js
 * serializa cualquier prop que cruce ese límite al bundle del navegador, así
 * que no alcanza con no renderizar un campo — hay que quitar su valor real
 * antes de que el objeto llegue ahí. Hoy solo `dropi_product_url` (enlace
 * manual a Dropi): se fuerza a `null` para que nunca viaje al navegador,
 * conservando el resto del shape de `Product` sin tocar los tipos de los
 * componentes cliente que ya lo reciben.
 */
export function toPublicProduct(product: Product): Product {
  return { ...product, dropi_product_url: null };
}

export function toPublicProducts(products: Product[]): Product[] {
  return products.map(toPublicProduct);
}
