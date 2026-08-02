import { revalidatePath } from "next/cache";

/**
 * Invalida los caches/SSG/ISR de las rutas que muestran stock o catálogo
 * tras un descuento atómico de stock. Idempotente y barato: sólo invalida
 * el bucket de caché de Next, no toca DB.
 *
 * Llamar SOLO cuando hubo un descuento real (no en early-return idempotente)
 * para evitar invalidaciones repetidas ante webhooks duplicados.
 *
 * Rutas invalidadas:
 * - /admin/productos       → tabla con columna Stock
 * - /productos             → catálogo público (badges "Agotado", stock)
 * - /                       → home (productos destacados)
 *
 * Las fichas /productos/[slug] no se invalidan acá porque ya son `dynamic`
 * por defecto y se consultan en cada request.
 */
export function revalidateAfterStockChange(options?: {
  /** Slugs de productos cuyas PDP queremos forzar a revalidar. */
  productSlugs?: ReadonlyArray<string>;
}) {
  try {
    revalidatePath("/admin/productos");
    revalidatePath("/productos");
    revalidatePath("/");
    if (options?.productSlugs?.length) {
      for (const slug of options.productSlugs) {
        if (slug) revalidatePath(`/productos/${slug}`);
      }
    }
  } catch (e) {
    // revalidatePath puede lanzar fuera de un request context (tests).
    // Logueamos y seguimos: la invalidación no es crítica para correctness.
    console.warn(
      "[revalidateAfterStockChange] no se pudo invalidar caches:",
      e instanceof Error ? e.message : String(e),
    );
  }
}
