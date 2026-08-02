/**
 * Totales de la fila `orders` tal como los persiste el backend al crear el pedido
 * (p. ej. `buildOrderInsertPayload` en `/api/flow/create`).
 * No recalcular desde catálogo ni desde ítems para el total del pedido.
 */
function toPersistedInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** Misma columna `total` que escribe el insert de Flow create; `total_amount` solo por compat futura. */
export function getOrderPersistedTotal(order: Record<string, unknown>): number {
  const raw = order.total ?? order.total_amount;
  return toPersistedInt(raw);
}

export function getOrderPersistedSubtotal(order: Record<string, unknown>): number {
  return toPersistedInt(order.subtotal);
}

export function getOrderPersistedShipping(order: Record<string, unknown>): number {
  return toPersistedInt(order.shipping_cost ?? order.shippingCost);
}

export function getOrderPersistedTotals(order: Record<string, unknown>): {
  subtotal: number;
  shipping_cost: number;
  total: number;
} {
  return {
    subtotal: getOrderPersistedSubtotal(order),
    shipping_cost: getOrderPersistedShipping(order),
    total: getOrderPersistedTotal(order),
  };
}

/**
 * Importe de línea según JSON guardado: si existe `line_total` / `lineTotal`, usarlo;
 * si no, `round(price) × quantity` con los valores guardados (sin ir a BD).
 */
export function getPersistedLineAmount(item: Record<string, unknown>): number {
  const lt = item.line_total ?? item.lineTotal;
  if (lt !== undefined && lt !== null && String(lt).trim() !== "") {
    const num = Number(lt);
    if (Number.isFinite(num)) return Math.round(num);
  }
  const unit = toPersistedInt(item.unit_price ?? item.price);
  const qtyRaw = item.quantity;
  const qty =
    typeof qtyRaw === "number" && Number.isFinite(qtyRaw)
      ? Math.max(1, Math.floor(qtyRaw))
      : Math.max(1, Math.floor(toPersistedInt(qtyRaw) || 1));
  return unit * qty;
}
