/**
 * Identificador único de producto para TODOS los eventos de Meta Pixel/CAPI
 * (ViewContent, AddToCart, InitiateCheckout, Purchase — navegador y servidor).
 *
 * Formato elegido: el `product_id` (UUID) de Supabase, tal cual, como string,
 * sin prefijo. Es el identificador estable que ya viaja igual por ficha,
 * carrito, checkout y orden — no hay que mapear nada distinto en cada punto.
 * Si más adelante conectan un catálogo de Meta Commerce Manager, ese catálogo
 * debería usar este mismo product_id como content_id para que los eventos
 * calcen con los productos del feed.
 */
export function toPixelContentId(productId: string): string {
  return String(productId);
}
