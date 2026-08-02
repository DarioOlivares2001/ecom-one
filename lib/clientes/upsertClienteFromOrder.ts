import { createCliente, getClienteByEmail, updateCliente } from "@/lib/db/repositories";

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

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  const message = error instanceof Error ? error.message : String(error);
  return code === "23505" || message.toLowerCase().includes("duplicate");
}

type ProfilePatch = {
  nombre: string | null;
  telefono: string | null;
  direccion: string | null;
  comuna: string | null;
};

function buildProfileUpdateFromOrder(profile: ProfilePatch): Record<string, string> {
  const u: Record<string, string> = {};
  if (profile.nombre) u.nombre = profile.nombre;
  if (profile.telefono) u.telefono = profile.telefono;
  if (profile.direccion) u.direccion = profile.direccion;
  if (profile.comuna) u.comuna = profile.comuna;
  return u;
}

async function bumpAndUpdateCliente(
  email: string,
  profile: ProfilePatch,
  orderDelta: number,
  lastOrderAt: string,
  cached?: { id: string; total_orders: number; total_spent: number }
): Promise<void> {
  let clienteId: string;
  let baseOrders: number;
  let baseSpent: number;

  if (cached != null) {
    clienteId = cached.id;
    baseOrders = cached.total_orders;
    baseSpent = cached.total_spent;
  } else {
    const row = await getClienteByEmail(email);
    if (!row) {
      console.error("[cliente-upsert] error", { phase: "fetch_metrics", email });
      return;
    }
    clienteId = row.id;
    baseOrders = row.total_orders;
    baseSpent = row.total_spent;
  }

  const nextOrders = baseOrders + 1;
  const nextSpent = baseSpent + orderDelta;
  const profileUpdates = buildProfileUpdateFromOrder(profile);

  try {
    await updateCliente(clienteId, {
      ...profileUpdates,
      total_orders: nextOrders,
      total_spent: nextSpent,
      last_order_at: lastOrderAt,
    });
  } catch (error) {
    console.error("[cliente-upsert] error", {
      phase: "update",
      message: error instanceof Error ? error.message : String(error),
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

/**
 * Tras crear un pedido: crea o actualiza `public.clientes` con el cliente admin.
 * No modifica `password_hash` ni `registered_at`. Métricas: +1 pedido, suma `total_spent`, `last_order_at`.
 * Fallos se registran con `[cliente-upsert]` y no deben propagarse al flujo de pago.
 */
export async function upsertClienteFromOrder(
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

  const nowIso = new Date().toISOString();
  const profilePatch: ProfilePatch = {
    nombre: nombreFromOrder,
    telefono,
    direccion,
    comuna,
  };

  try {
    console.log("[cliente-upsert] buscando", { email });

    const existing = await getClienteByEmail(email);

    if (!existing) {
      try {
        await createCliente({
          email,
          nombre: nombreInsert,
          telefono,
          direccion,
          comuna,
          total_orders: 1,
          total_spent: total,
          last_order_at: nowIso,
        });
      } catch (insertError) {
        if (isUniqueViolation(insertError)) {
          console.log("[cliente-upsert] buscando", {
            email,
            note: "reintento tras carrera en insert",
          });
          await bumpAndUpdateCliente(email, profilePatch, total, nowIso);
        } else {
          console.error("[cliente-upsert] error", {
            phase: "insert",
            message: insertError instanceof Error ? insertError.message : String(insertError),
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

    await bumpAndUpdateCliente(email, profilePatch, total, nowIso, {
      id: existing.id,
      total_orders: existing.total_orders,
      total_spent: existing.total_spent,
    });
  } catch (e) {
    console.error("[cliente-upsert] error", { phase: "excepción", email, error: String(e) });
  }
}
