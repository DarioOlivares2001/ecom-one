/**
 * Evita redirecciones abiertas: solo rutas internas relativas.
 * No usar para destinos externos.
 */
export function getSafePostLoginRedirect(
  raw: string | string[] | null | undefined,
  fallback: string
): string {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s == null || typeof s !== "string") return fallback;
  let decoded = s.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return fallback;
  }
  if (!decoded.startsWith("/")) return fallback;
  if (decoded.startsWith("//")) return fallback;
  if (decoded.includes("://")) return fallback;
  if (decoded.includes("\\")) return fallback;
  const pathOnly = decoded.split("?")[0]?.split("#")[0] ?? "";
  const lowerPath = pathOnly.toLowerCase();
  if (lowerPath.startsWith("/admin")) return fallback;
  if (lowerPath.startsWith("/cuenta/login")) return fallback;
  if (lowerPath.startsWith("/cuenta/registro")) return fallback;
  if (lowerPath.startsWith("/cuenta/crear")) return fallback;
  if (decoded.length > 2048) return fallback;
  return decoded;
}
