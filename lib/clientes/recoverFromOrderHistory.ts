import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeClienteEmail } from "@/lib/clientes/upsertClienteFromOrder";

export type RecoveredSnapshot = {
  nombre: string;
  telefono: string;
  direccion: string;
  comuna: string;
  region: string;
  pais: string;
};

export type RecoverFromOrdersResult = {
  pastOrdersCount: number;
  lastSnapshot: RecoveredSnapshot | null;
};

function trimStr(s: unknown): string {
  if (s == null) return "";
  if (typeof s !== "string") return String(s).trim();
  return s.trim();
}

function addressKey(d: string, c: string, r: string): string {
  return `${trimStr(d).toLowerCase()}|${trimStr(c).toLowerCase()}|${trimStr(r).toLowerCase()}`;
}

function parseShipping(raw: unknown): { direccion: string; comuna: string; region: string } {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const direccion = trimStr(o.direccion ?? o.address ?? o.street);
  const comuna = trimStr(o.ciudad ?? o.comuna ?? o.city ?? o.locality);
  const region = trimStr(o.region ?? o.state);
  return { direccion, comuna, region };
}

type DirRow = {
  id: string;
  direccion: string;
  comuna: string;
  region: string;
  is_default?: boolean;
};

/**
 * Importa nombre, teléfono y dirección principal desde el último pedido con el mismo email normalizado.
 * Idempotente: no duplica direcciones (misma dirección+comuna+región) y no pisa nombre/teléfono ya guardados.
 */
export async function recoverClienteFromOrderHistory(
  supabase: SupabaseClient,
  clienteId: string,
  normEmail: string
): Promise<RecoverFromOrdersResult> {
  const email = normalizeClienteEmail(normEmail);
  if (!email || !clienteId) {
    return { pastOrdersCount: 0, lastSnapshot: null };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabase as any;

  const { data: ordersRaw, error: ordErr } = await admin
    .from("orders")
    .select("id, created_at, customer_email, customer_name, customer_phone, shipping_address")
    .ilike("customer_email", email)
    .order("created_at", { ascending: false })
    .limit(100);

  if (ordErr) {
    console.error("[recover-from-orders] select orders", ordErr.message);
    return { pastOrdersCount: 0, lastSnapshot: null };
  }

  const orders = (ordersRaw ?? []).filter(
    (o: { customer_email?: string }) => normalizeClienteEmail(String(o.customer_email ?? "")) === email
  );

  const pastOrdersCount = orders.length;
  if (pastOrdersCount === 0) {
    return { pastOrdersCount: 0, lastSnapshot: null };
  }

  const latest = orders[0] as {
    customer_name?: string | null;
    customer_phone?: string | null;
    shipping_address?: unknown;
  };

  const ship = parseShipping(latest.shipping_address);
  const orderNombre = trimStr(latest.customer_name);
  const orderTel = trimStr(latest.customer_phone);

  const lastSnapshot: RecoveredSnapshot = {
    nombre: orderNombre || "Cliente",
    telefono: orderTel,
    direccion: ship.direccion,
    comuna: ship.comuna,
    region: ship.region,
    pais: "Chile",
  };

  const { data: clienteRow } = await admin
    .from("clientes")
    .select("nombre, telefono")
    .eq("id", clienteId)
    .maybeSingle();

  const currentNombre = trimStr(clienteRow?.nombre);
  const currentTel = trimStr(clienteRow?.telefono);

  const patch: Record<string, string> = {};
  if (!currentNombre && orderNombre) patch.nombre = orderNombre;
  if (!currentTel && orderTel) patch.telefono = orderTel;

  if (Object.keys(patch).length) {
    const { error: upCErr } = await admin.from("clientes").update(patch).eq("id", clienteId);
    if (upCErr) console.error("[recover-from-orders] update cliente", upCErr.message);
  }

  const { data: dirsRaw } = await admin
    .from("cliente_direcciones")
    .select("id, direccion, comuna, region, is_default")
    .eq("cliente_id", clienteId);

  const dirRows: DirRow[] = Array.isArray(dirsRaw) ? dirsRaw : [];
  const fpOrder = addressKey(ship.direccion, ship.comuna, ship.region);
  const hasConcreteAddr =
    ship.direccion.length >= 4 && ship.comuna.length >= 2 && ship.region.length >= 2;

  const rowFp = (r: DirRow) => addressKey(r.direccion, r.comuna, r.region);
  const hasDefault = dirRows.some((r) => r.is_default);
  const sameFpRow = dirRows.find((r) => rowFp(r) === fpOrder);

  async function clearDefaults(): Promise<void> {
    await admin.from("cliente_direcciones").update({ is_default: false }).eq("cliente_id", clienteId);
  }

  if (hasConcreteAddr && fpOrder !== "||") {
    if (sameFpRow) {
      if (!hasDefault) {
        await clearDefaults();
        const { error: e2 } = await admin
          .from("cliente_direcciones")
          .update({ is_default: true })
          .eq("id", sameFpRow.id);
        if (e2) console.error("[recover-from-orders] set default", e2.message);
      }
    } else if (!hasDefault) {
      await clearDefaults();
      const { error: insE } = await admin.from("cliente_direcciones").insert({
        cliente_id: clienteId,
        nombre: "Principal",
        direccion: ship.direccion,
        comuna: ship.comuna,
        region: ship.region,
        referencia: null,
        telefono: orderTel || null,
        is_default: true,
      });
      if (insE) console.error("[recover-from-orders] insert dir", insE.message);
    }
  }

  return { pastOrdersCount, lastSnapshot };
}
