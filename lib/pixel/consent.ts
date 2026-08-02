/**
 * Punto de control único para consentimiento de marketing/tracking.
 *
 * Hoy no existe banner de cookies, así que el consentimiento se asume
 * otorgado (`true`) y no se bloquea nada. Cuando se agregue un banner:
 *   1. Reemplazar el `return true` de abajo por la lectura real del
 *      consentimiento (cookie, localStorage, o el estado del banner).
 *   2. `MetaPixelScript` ya llama a esta función antes de montar el
 *      <script> del Pixel — si devuelve `false`, el pixel del navegador
 *      no se carga y todas las llamadas de `pixelEvents` quedan en no-op
 *      (ya chequean `typeof fbq === "undefined"`).
 *   3. Para Conversions API (servidor), `lib/pixel/capi.ts` no tiene forma
 *      de conocer el consentimiento del navegador en el webhook async de
 *      Flow — si el consentimiento debe bloquear también el envío server-side,
 *      hay que capturarlo en /api/flow/create (igual que client_ip_address)
 *      y persistirlo en la orden para que el webhook lo relea.
 */
export function hasMarketingConsent(): boolean {
  return true;
}
