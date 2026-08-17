function normalizeImageUrl(raw: unknown): string | null {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

export type OrderItemImageSources = {
  /** Imagen guardada en la propia línea al momento del pedido (`item.image`). */
  snapshot: string | null;
  /**
   * Primera imagen pública *actual* del producto (`productImages[product_id]`),
   * para cuando el snapshot falta o falla al cargar (pedido histórico apuntando
   * a un objeto que ya no existe). `null` si no hay dato o es idéntica al
   * snapshot — no tiene sentido reintentar la misma URL rota dos veces.
   */
  fallback: string | null;
};

/**
 * Fuentes de imagen para una línea de pedido, en orden de prioridad:
 * primero el snapshot de la línea, luego la imagen pública actual del
 * producto. El llamador decide cuándo pasar de una a otra (normalmente:
 * intentar `snapshot`, y solo si falla al cargar, intentar `fallback`).
 */
export function resolveOrderItemImage(
  item: { product_id?: unknown; image?: unknown },
  productImages: Record<string, string | null> | undefined
): OrderItemImageSources {
  const snapshot = normalizeImageUrl(item.image);

  const productId = typeof item.product_id === "string" ? item.product_id : null;
  const rawFallback = productId ? productImages?.[productId] : null;
  const fallback = normalizeImageUrl(rawFallback);

  return {
    snapshot,
    fallback: fallback && fallback !== snapshot ? fallback : null,
  };
}
