import type { SupabaseClient } from "@supabase/supabase-js";

/** Email como clave de cliente: trim + minúsculas (único en `public.clientes`). */
export function normalizeClienteEmail(email: string): string {
  return String(email).trim().toLowerCase();
}

export type ClienteCheckoutPayload = {
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
};

function trimOrNull(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t.length ? t : null;
}

/**
 * Tras crear un pedido: crea o actualiza `public.clientes` con el cliente admin (service_role).
 * No modifica `password_hash` ni `registered_at`. Métricas: +1 pedido, suma `total_spent`, `last_order_at`.
 * Fallos se registran con `[cliente-upsert]` y no deben propagarse al flujo de pago.
 */
export async function upsertClienteFromOrder(
  supabase: SupabaseClient,
  customer: ClienteCheckoutPayload,
  orderTotalClp: number
): Promise<void> {
  const email = normalizeClienteEmail(customer.email);
  if (!email) {
    console.error("[cliente-upsert] error", { reason: "email vacío tras normalizar" });
    return;
  }

  const nombreFromOrder = trimOrNull(customer.name);
  const nombreInsert = nombreFromOrder ?? "Cliente";
  const telefono = trimOrNull(customer.phone ?? undefined);
  const direccion = trimOrNull(customer.address ?? undefined);
  const city = trimOrNull(customer.city ?? undefined);
  const region = trimOrNull(customer.region ?? undefined);
  const comuna = city ?? region ?? null;

  const total = Math.round(Number(orderTotalClp));
  if (!Number.isFinite(total) || total < 0) {
    console.error("[cliente-upsert] error", { reason: "total inválido", email, orderTotalClp });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const nowIso = new Date().toISOString();

  /** Campos de perfil: en update solo se escriben si el pedido trae valor. */
  const profilePatch = {
    nombre: nombreFromOrder,
    telefono,
    direccion,
    comuna,
  };

  try {
    console.log("[cliente-upsert] buscando", { email });

    const { data: existing, error: selectError } = await sb
      .from("clientes")
      .select("id,total_orders,total_spent")
      .eq("email", email)
      .maybeSingle();

    if (selectError) {
      console.error("[cliente-upsert] error", {
        phase: "select",
        message: selectError.message,
        email,
      });
      return;
    }

    if (!existing) {
      const { error: insertError } = await sb.from("clientes").insert({
        email,
        nombre: nombreInsert,
        telefono,
        direccion,
        comuna,
        total_orders: 1,
        total_spent: total,
        last_order_at: nowIso,
      });

      if (insertError) {
        const dup =
          insertError.code === "23505" ||
          String(insertError.message).toLowerCase().includes("duplicate");
        if (dup) {
          console.log("[cliente-upsert] buscando", { email, note: "reintento tras carrera en insert" });
          await bumpAndUpdateCliente(sb, email, profilePatch, total, nowIso);
        } else {
          console.error("[cliente-upsert] error", {
            phase: "insert",
            message: insertError.message,
            email,
          });
        }
        return;
      }

      console.log("[cliente-upsert] creado", {
        email,
        total_orders: 1,
        total_spent: total,
      });
      return;
    }

    await bumpAndUpdateCliente(
      sb,
      email,
      profilePatch,
      total,
      nowIso,
      { total_orders: existing.total_orders, total_spent: existing.total_spent }
    );
  } catch (e) {
    console.error("[cliente-upsert] error", { phase: "excepción", email, error: String(e) });
  }
}

function buildProfileUpdateFromOrder(profile: {
  nombre: string | null;
  telefono: string | null;
  direccion: string | null;
  comuna: string | null;
}): Record<string, string> {
  const u: Record<string, string> = {};
  if (profile.nombre) u.nombre = profile.nombre;
  if (profile.telefono) u.telefono = profile.telefono;
  if (profile.direccion) u.direccion = profile.direccion;
  if (profile.comuna) u.comuna = profile.comuna;
  return u;
}

async function bumpAndUpdateCliente(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  email: string,
  profile: {
    nombre: string | null;
    telefono: string | null;
    direccion: string | null;
    comuna: string | null;
  },
  orderDelta: number,
  lastOrderAt: string,
  cached?: { total_orders: number; total_spent: number }
): Promise<void> {
  let baseOrders: number;
  let baseSpent: number;

  if (
    cached != null &&
    typeof cached.total_orders === "number" &&
    typeof cached.total_spent === "number"
  ) {
    baseOrders = cached.total_orders;
    baseSpent = cached.total_spent;
  } else {
    const { data: row, error } = await sb
      .from("clientes")
      .select("total_orders,total_spent")
      .eq("email", email)
      .maybeSingle();

    if (error || !row) {
      console.error("[cliente-upsert] error", {
        phase: "fetch_metrics",
        message: error?.message,
        email,
      });
      return;
    }
    baseOrders = row.total_orders;
    baseSpent = row.total_spent;
  }

  const nextOrders = baseOrders + 1;
  const nextSpent = baseSpent + orderDelta;
  const profileUpdates = buildProfileUpdateFromOrder(profile);

  const { error: updateError } = await sb
    .from("clientes")
    .update({
      ...profileUpdates,
      total_orders: nextOrders,
      total_spent: nextSpent,
      last_order_at: lastOrderAt,
    })
    .eq("email", email);

  if (updateError) {
    console.error("[cliente-upsert] error", {
      phase: "update",
      message: updateError.message,
      email,
    });
    return;
  }

  console.log("[cliente-upsert] actualizado", {
    email,
    total_orders: nextOrders,
    total_spent: nextSpent,
    campos_perfil: Object.keys(profileUpdates),
  });
}
