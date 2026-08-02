import { getOrderByDisplayCodeAndEmail } from "@/lib/db/repositories/orders";

/** Campos mínimos para la vista pública de seguimiento (sin id ni tokens de pago). */
export type PublicOrderTracking = {
  order_number: number;
  display_code: string | null;
  status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  items: unknown;
  subtotal: number;
  shipping_cost: number;
  total: number;
  created_at: string;
};

/**
 * Busca un pedido por display_code (ej. "SO00000086") y valida que pertenezca al email indicado.
 * Siempre requiere ownerEmail — nunca devuelve un pedido sin verificar propiedad.
 * Devuelve null tanto si el pedido no existe como si el email no coincide
 * (mensaje genérico para no filtrar información).
 */
export async function getPublicOrderByDisplayCode(
  displayCode: string,
  ownerEmail: string
): Promise<PublicOrderTracking | null> {
  const code = displayCode.trim().toUpperCase();
  if (!code) return null;
  const normalizedEmail = ownerEmail.trim().toLowerCase();
  if (!normalizedEmail) return null;

  try {
    const order = await getOrderByDisplayCodeAndEmail(code, normalizedEmail);
    if (!order) return null;

    return {
      order_number: order.order_number,
      display_code: order.display_code,
      status: order.status,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      items: order.items,
      subtotal: order.subtotal,
      shipping_cost: order.shipping_cost,
      total: order.total,
      created_at: order.created_at,
    };
  } catch (e) {
    console.error("[seguimiento] getPublicOrderByDisplayCode excepción", e);
    return null;
  }
}
