import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type ConfirmPaidResult =
  | {
      ok: true;
      alreadyDiscounted: boolean;
      decrementedLines: number;
      finalStatus: string;
    }
  | { ok: false; error: string; code?: string };

/**
 * Forma esperada de cada fila devuelta por la RPC
 * `confirm_paid_order_and_decrement_stock`.
 */
type ConfirmPaidRpcRow = {
  order_id: string;
  already_discounted: boolean;
  decremented_lines: number;
  final_status: string;
};

/**
 * Marca la orden como `paid` (si estaba `pending`) y descuenta stock atómicamente.
 *
 * - Idempotente: si la orden ya tenía stock descontado, no vuelve a descontar.
 * - Atómica vía RPC SECURITY DEFINER con `FOR UPDATE`: evita carreras entre webhook
 *   duplicado, mock branch, o cambios manuales.
 * - Si el stock no alcanza, la RPC levanta excepción y nada se descuenta.
 */
export async function confirmPaidOrderAndDecrementStock(
  admin: SupabaseClient<Database>,
  orderId: string
): Promise<ConfirmPaidResult> {
  try {
    // Cast: la inferencia genérica de `rpc()` con nuestro `Database` no
    // resuelve correctamente `Args` (queda como `never`), así que usamos el
    // cliente sin tipos genéricos solo para esta llamada y validamos el
    // resultado manualmente con `ConfirmPaidRpcRow`.
    const untyped = admin as unknown as SupabaseClient;
    const { data, error } = await untyped.rpc(
      "confirm_paid_order_and_decrement_stock",
      { p_order_id: orderId }
    );
    if (error) {
      return { ok: false, error: error.message, code: error.code };
    }
    const rowsArr = (Array.isArray(data) ? data : [data]) as ConfirmPaidRpcRow[];
    const row = rowsArr[0];
    if (!row) {
      return { ok: false, error: "Sin respuesta del RPC de descuento de stock." };
    }
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
