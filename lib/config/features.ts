/**
 * Flags de features opcionales para esta tienda/nicho. Apagar un flag solo
 * oculta el render en el frontend: lógica, endpoints y datos en BD quedan
 * intactos para poder reactivarlo rápido en otro nicho.
 */

/** Bloques de ofertas/upsells en el carrito (CartDrawer) y en checkout (CheckoutRecommendations). */
export const SHOW_CART_UPSELLS = false;

/**
 * Descuento por cantidad real end-to-end: hint en el carrito ("Agrega 1 más
 * y desbloquea X% OFF"), precio de línea en carrito/checkout
 * (recalculateCheckoutOrder.ts) y el bloque "Packs y ahorro" de la ficha de
 * producto. Activado para que lo que se muestra en la ficha sea exactamente
 * lo que se cobra — antes quedaba inerte en todo el flujo real aunque un
 * producto tuviera discount_enabled + discount_steps configurados.
 */
export const SHOW_VOLUME_DISCOUNTS = true;
