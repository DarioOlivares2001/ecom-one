/**
 * Valida si una URL de imagen es segura para pasar a `next/image`: local (bajo
 * `/public`) o del host público de Cloudflare R2. Cualquier otra cosa (URLs
 * viejas de `*.supabase.co`, dominios desconocidos, datos corruptos) se
 * rechaza para que el componente que llama muestre un fallback visual en vez
 * de dejar que `next/image` rompa el render por un hostname no configurado en
 * `images.remotePatterns`.
 *
 * `NEXT_PUBLIC_R2_PUBLIC_URL` es un espejo de `R2_PUBLIC_URL` (ya pública por
 * diseño, ver `.env.example`) inyectado en `next.config.mjs` para que este
 * chequeo funcione igual en Server y Client Components sin exponer ninguna
 * variable nueva ni secreta.
 */
function getAllowedImageHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

export function isAllowedImageSrc(src: string | null | undefined): src is string {
  if (!src) return false;
  const trimmed = src.trim();
  if (!trimmed) return false;

  // Asset local bajo /public (ej. iconos propios) — siempre permitido.
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;

  const allowedHost = getAllowedImageHost();
  return allowedHost !== null && parsed.hostname === allowedHost;
}

/** Filtra un array de URLs de imagen dejando solo las que pasan `isAllowedImageSrc`. */
export function sanitizeImageUrls(urls: readonly (string | null | undefined)[] | null | undefined): string[] {
  if (!Array.isArray(urls)) return [];
  return urls.filter(isAllowedImageSrc);
}
