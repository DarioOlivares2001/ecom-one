/**
 * Ítem mínimo para calcular valor de productos: cualquier CartItem, línea de
 * orden (RecalculatedOrderLine) o item de `orders.items` (JSON) sirve, ya que
 * todos tienen `price`/`quantity`.
 */
export type PixelLineItem = { price: number; quantity: number };

/**
 * Suma ÚNICA y compartida del valor de productos para los 4 eventos de Meta
 * Pixel/CAPI que llevan `value` (ViewContent, AddToCart, InitiateCheckout,
 * Purchase). Úsala siempre — nunca sumar `price * quantity` a mano en otro
 * lugar, para que los cuatro eventos del embudo no puedan divergir.
 *
 * A propósito NO incluye envío, impuestos ni ningún otro cargo — solo el
 * valor de los productos. Así el ROAS que ve Meta refleja margen real
 * (ingreso por productos) y no el ingreso bruto cobrado, que varía según
 * el costo de envío configurado y no tiene relación con qué tan bueno
 * fue el anuncio que atrajo la compra.
 *
 * Devuelve un entero CLP (sin decimales).
 */
export function sumProductsValue(items: PixelLineItem[]): number {
  const raw = items.reduce((acc, item) => {
    const price = Number.isFinite(item.price) ? item.price : 0;
    const quantity = Number.isFinite(item.quantity) ? item.quantity : 0;
    return acc + price * quantity;
  }, 0);
  return Math.round(raw);
}
