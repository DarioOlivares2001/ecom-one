import { confirmPaidOrderAndDecrementStock as callConfirmPaidOrderFn } from "@/lib/db/transactions/confirmPaidOrder";

export type ConfirmPaidResult =
  | {
      ok: true;
      alreadyDiscounted: boolean;
      decrementedLines: number;
      finalStatus: string;
    }
  | { ok: false; error: string; code?: string };

/**
 * Marca la orden como `paid` (si estaba `pending`) y descuenta stock atómicamente.
 *
 * - Idempotente: si la orden ya tenía stock descontado, no vuelve a descontar.
 * - Atómica vía función Postgres nativa con `FOR UPDATE`: evita carreras entre webhook
 *   duplicado, mock branch, o cambios manuales.
 * - Si el stock no alcanza, la función levanta excepción y nada se descuenta.
 */
export async function confirmPaidOrderAndDecrementStock(
  orderId: string
): Promise<ConfirmPaidResult> {
  try {
    const row = await callConfirmPaidOrderFn(orderId);
    return {
      ok: true,
      alreadyDiscounted: Boolean(row.already_discounted),
      decrementedLines: Number(row.decremented_lines) || 0,
      finalStatus: String(row.final_status ?? ""),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
