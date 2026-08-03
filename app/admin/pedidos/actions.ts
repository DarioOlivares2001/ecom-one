"use server";

import { revalidatePath } from "next/cache";
import { updateOrder } from "@/lib/db/repositories/orders";
import { confirmPaidOrderAndDecrementStock } from "@/lib/orders/confirmPaidAndDecrementStock";
import { getAdminSessionFromCookies } from "@/lib/admin/session";

const VALID = ["pending", "paid", "preparing", "shipped", "delivered", "cancelled"] as const;
type OrderStatus = (typeof VALID)[number];

export async function updateOrderStatusAction(
  id: string,
  status: string
): Promise<{ error?: string }> {
  if (!getAdminSessionFromCookies()) {
    return { error: "No autorizado." };
  }

  const normalizedStatus = status === "ready_to_ship" ? "shipped" : status;
  if (!VALID.includes(normalizedStatus as OrderStatus)) return { error: "Estado inválido." };

  if (normalizedStatus === "paid") {
    // La función nativa marca status='paid' Y descuenta stock en la misma transacción atómica.
    // No hacemos UPDATE previo: si falla, la orden queda en su estado original sin tocar.
    const stockRes = await confirmPaidOrderAndDecrementStock(id);
    if (!stockRes.ok) return { error: `No se pudo confirmar el pago: ${stockRes.error}` };
  } else {
    try {
      await updateOrder(id, { status: normalizedStatus as OrderStatus });
    } catch (error) {
      return { error: error instanceof Error ? error.message : "No se pudo actualizar la orden." };
    }
  }

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${id}`);
  return {};
}
