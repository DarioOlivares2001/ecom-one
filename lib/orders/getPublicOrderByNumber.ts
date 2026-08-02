import { createAdminClient } from "@/lib/supabase/admin";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { data, error } = await admin
      .from("orders")
      .select(
        "order_number, display_code, status, customer_name, customer_email, customer_phone, items, subtotal, shipping_cost, total, created_at"
      )
      .eq("display_code", code)
      .ilike("customer_email", normalizedEmail)
      .maybeSingle();

    if (error) {
      console.error("[seguimiento] getPublicOrderByDisplayCode", error.message);
      return null;
    }
    if (!data) return null;

    return data as PublicOrderTracking;
  } catch (e) {
    console.error("[seguimiento] getPublicOrderByDisplayCode excepción", e);
    return null;
  }
}
