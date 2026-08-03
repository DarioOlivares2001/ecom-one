/**
 * Email como clave de cliente: trim + minúsculas (único en `public.clientes`).
 * Función pura sin dependencias — a propósito en su propio archivo, separada
 * de `upsertClienteFromOrder.ts` (que sí importa la capa de datos/Drizzle),
 * para que los componentes cliente puedan normalizar un email sin arrastrar
 * `lib/db/client.ts` (y por lo tanto `DATABASE_URL`) al bundle del navegador.
 */
export function normalizeClienteEmail(email: string): string {
  return String(email).trim().toLowerCase();
}
