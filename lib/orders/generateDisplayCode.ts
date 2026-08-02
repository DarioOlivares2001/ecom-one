/**
 * Genera el código visible para el cliente a partir del order_number interno.
 * offset viene de store_settings.order_number_offset.
 * Ejemplo: orderNumber=86, offset=1000000 → "SO01000086"
 */
export function generateDisplayCode(orderNumber: number, offset: number): string {
  return "SO" + String(orderNumber + offset).padStart(8, "0");
}
