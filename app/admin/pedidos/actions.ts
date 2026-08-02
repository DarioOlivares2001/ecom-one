"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmPaidOrderAndDecrementStock } from "@/lib/orders/confirmPaidAndDecrementStock";

const VALID = ["pending", "paid", "preparing", "shipped", "delivered", "cancelled"] as const;
type OrderStatus = (typeof VALID)[number];

export async function updateOrderStatusAction(
  id: string,
  status: string
): Promise<{ error?: string }> {
  const normalizedStatus = status === "ready_to_ship" ? "shipped" : status;
  if (!VALID.includes(normalizedStatus as OrderStatus)) return { error: "Estado inválido." };

  const admin = createAdminClient();

  if (normalizedStatus === "paid") {
    // La RPC marca status='paid' Y descuenta stock en la misma transacción atómica.
    // No hacemos UPDATE previo: si falla, la orden queda en su estado original sin tocar.
    const stockRes = await confirmPaidOrderAndDecrementStock(admin, id);
    if (!stockRes.ok) return { error: `No se pudo confirmar el pago: ${stockRes.error}` };
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from("orders")
      .update({ status: normalizedStatus })
      .eq("id", id);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${id}`);
  return {};
}
