/**
 * Envío gratis sobre umbral en CLP. `cost` y `freeThreshold` vienen de
 * `store_settings` (ver `getStoreSettings()`) — no hay defaults acá para
 * evitar una segunda fuente de verdad; los defaults viven en
 * `DEFAULT_STORE_SETTINGS` (lib/store-settings/getStoreSettings.ts).
 */
export function computeShippingCostClp(
  itemsSubtotal: number,
  cost: number,
  freeThreshold: number
): number {
  const s = Number.isFinite(itemsSubtotal) && !Number.isNaN(itemsSubtotal) ? Math.max(0, itemsSubtotal) : 0;
  return s >= freeThreshold ? 0 : cost;
}
