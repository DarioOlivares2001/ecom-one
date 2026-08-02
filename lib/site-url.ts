/**
 * URL pública absoluta del sitio (Flow urlReturn/urlConfirmation, emails, metadata).
 * Orden: NEXT_PUBLIC_SITE_URL → SITE_URL → https://VERCEL_URL → localhost.
 * En Vercel, si no configuras la variable, se usa el host del deploy actual (VERCEL_URL).
 */
export function getPublicSiteUrl(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  if (fromEnv) return fromEnv;

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//i, "");
    return `https://${host}`;
  }

  return "http://localhost:3000";
}
