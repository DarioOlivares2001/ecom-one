/**
 * Imagen de una línea de pedido: prioriza el snapshot guardado en la propia
 * línea (`item.image`, tal como estaba la galería pública del producto al
 * momento del pedido); si no existe (pedidos de antes de este snapshot),
 * cae a la primera imagen pública *actual* del producto (`productImages`).
 * Si ninguna existe, devuelve `null` — el llamador debe mostrar un placeholder,
 * nunca un `<img>` con `src` vacío.
 */
export function resolveOrderItemImage(
  item: { product_id?: unknown; image?: unknown },
  productImages: Record<string, string | null> | undefined
): string | null {
  const fromLine = typeof item.image === "string" ? item.image.trim() : "";
  if (fromLine) return fromLine;

  const productId = typeof item.product_id === "string" ? item.product_id : null;
  const fallback = productId ? productImages?.[productId] : null;
  return fallback && fallback.trim() ? fallback.trim() : null;
}
