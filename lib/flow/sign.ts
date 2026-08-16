import crypto from "crypto";

/**
 * HMAC-SHA256 sobre los parámetros ordenados alfabéticamente por clave,
 * concatenados como `${key}${value}` — esquema de firma de Flow Chile.
 * Antes duplicada idéntica en `app/api/flow/create`, `app/api/flow/webhook`
 * y `app/api/orders/cancel-if-unpaid`; centralizada acá sin cambio de lógica.
 */
export function sign(params: Record<string, string>, secret: string): string {
  const message = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}
