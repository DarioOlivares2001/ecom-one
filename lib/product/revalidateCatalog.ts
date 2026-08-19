import { revalidatePath } from "next/cache";

/**
 * Invalida de forma dirigida las rutas públicas del catálogo que dependen de
 * qué productos están `active` / `deleted_at IS NULL` en Neon: `/`,
 * `/productos` y, si se conoce, `/productos/[slug]`.
 *
 * `/productos` (a diferencia de `/admin/productos`) NO usa
 * `dynamic = "force-dynamic"` a propósito — perder el cache estático de esa
 * ruta para todo el sitio sería un atajo desproporcionado. Pero eso significa
 * que sin esta invalidación dirigida, crear/editar/archivar/restaurar un
 * producto no se refleja en el catálogo público hasta el próximo build,
 * aunque el producto ya esté activo en Neon — por eso cada acción de admin
 * que cambia la visibilidad de un producto debe llamar a esto.
 *
 * `revalidate` es inyectable (por defecto, la `revalidatePath` real de
 * `next/cache`) para poder probar qué rutas se invalidan sin depender del
 * runtime de request de Next — ver `scripts/verify-catalog-revalidation.ts`.
 */
export function revalidateProductCatalog(
  slug?: string | null,
  revalidate: (path: string) => void = revalidatePath
): void {
  revalidate("/productos");
  revalidate("/");
  const trimmedSlug = slug?.trim();
  if (trimmedSlug) {
    revalidate(`/productos/${trimmedSlug}`);
  }
}
