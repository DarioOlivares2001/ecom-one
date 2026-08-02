/**
 * Normaliza el estado de pedido a una clave en minúsculas para mapeos (no modifica BD).
 * Acepta mayúsculas / mixtas; `ready_to_ship` se trata como `shipped`.
 */
export function normalizeOrderStatusKey(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== "string") return "";
  const s = raw.trim().toLowerCase();
  if (!s) return "";
  if (s === "ready_to_ship") return "shipped";
  return s;
}

const STATUS_LABEL_ES: Record<string, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  processing: "En preparación",
  preparing: "En preparación",
  shipped: "En camino",
  delivered: "Entregado",
  cancelled: "Cancelado",
  failed: "Fallido",
  refunded: "Reembolsado",
};

/**
 * Etiqueta en español para mostrar en UI. Los valores en BD no cambian.
 */
export function formatOrderStatus(raw: string | null | undefined): string {
  const key = normalizeOrderStatusKey(raw);
  if (!key) return "—";
  return STATUS_LABEL_ES[key] ?? String(raw).trim();
}
