import { FLOW_API_KEY, FLOW_API_URL, FLOW_SECRET_KEY } from "@/lib/flow/config";
import { sign } from "@/lib/flow/sign";

export interface FlowPaymentStatusResult {
  /** `false` si Flow respondió con un HTTP de error (no confundir con "rechazado", que es `statusCode === 3`). */
  ok: boolean;
  httpStatus: number;
  /** Status numérico de Flow: 1 pendiente, 2 pagado, 3 rechazado, 4 cancelado. `NaN` si no vino o `ok` es falso. */
  statusCode: number;
  /** `commerceOrder` (nuestro `display_code`) que Flow devuelve — usado por el webhook para encontrar la orden. */
  commerceOrder: string;
  raw: Record<string, unknown>;
}

/**
 * Consulta `payment/getStatus` a Flow, firmado con el mismo esquema que
 * `payment/create`. Antes duplicado con variaciones menores en
 * `app/api/flow/webhook` y `app/api/orders/cancel-if-unpaid`; centralizado
 * acá para que ambas rutas (y la nueva verificación directa en el retorno
 * del navegador) consulten a Flow exactamente de la misma forma.
 */
export async function getFlowPaymentStatus(token: string): Promise<FlowPaymentStatusResult> {
  const queryParams: Record<string, string> = { apiKey: FLOW_API_KEY, token };
  queryParams.s = sign(queryParams, FLOW_SECRET_KEY);
  const qs = new URLSearchParams(queryParams).toString();

  const res = await fetch(`${FLOW_API_URL}/payment/getStatus?${qs}`, { method: "GET" });
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  return {
    ok: res.ok,
    httpStatus: res.status,
    statusCode: res.ok ? Number(raw.status) : NaN,
    commerceOrder: String(raw.commerceOrder ?? "").trim(),
    raw,
  };
}
