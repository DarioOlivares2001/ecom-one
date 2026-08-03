/**
 * Enlace manual al producto en Dropi (app.dropi.cl / app.dropi.co). Solo un
 * link que el admin pega a mano — nunca hay llamadas a Dropi desde este
 * proyecto (ni API, ni scraping, ni automatización de compra).
 */
export const DROPI_ALLOWED_HOSTS = ["app.dropi.cl", "app.dropi.co"] as const;

export type DropiUrlValidation =
  | { ok: true; url: string | null }
  | { ok: false; error: string };

/**
 * Valida una URL de producto en Dropi: debe ser `https://` y su host debe
 * estar en `DROPI_ALLOWED_HOSTS`. Vacío/undefined es válido (campo opcional,
 * sin enlace) y devuelve `url: null`.
 */
export function validateDropiProductUrl(raw: string | null | undefined): DropiUrlValidation {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return { ok: true, url: null };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "La URL de Dropi no es válida." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "La URL de Dropi debe empezar con https://." };
  }

  const host = parsed.hostname.toLowerCase();
  if (!(DROPI_ALLOWED_HOSTS as readonly string[]).includes(host)) {
    return {
      ok: false,
      error: `El enlace debe ser de un dominio oficial de Dropi (${DROPI_ALLOWED_HOSTS.join(", ")}).`,
    };
  }

  return { ok: true, url: parsed.toString() };
}
