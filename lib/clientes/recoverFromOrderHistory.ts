import { normalizeClienteEmail } from "@/lib/clientes/upsertClienteFromOrder";
import { listOrdersByEmailCaseInsensitive } from "@/lib/db/repositories/orders";
import { getClienteById, updateCliente } from "@/lib/db/repositories/clientes";
import {
  createDireccion,
  listDireccionesByClienteId,
  updateDireccion,
} from "@/lib/db/repositories/clienteDirecciones";

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

/**
 * Importa nombre, teléfono y dirección principal desde el último pedido con el mismo email normalizado.
 * Idempotente: no duplica direcciones (misma dirección+comuna+región) y no pisa nombre/teléfono ya guardados.
 */
export async function recoverClienteFromOrderHistory(
  clienteId: string,
  normEmail: string
): Promise<RecoverFromOrdersResult> {
  const email = normalizeClienteEmail(normEmail);
  if (!email || !clienteId) {
    return { pastOrdersCount: 0, lastSnapshot: null };
  }

  let ordersList;
  try {
    ordersList = await listOrdersByEmailCaseInsensitive(email, 100);
  } catch (ordErr) {
    console.error("[recover-from-orders] select orders", ordErr);
    return { pastOrdersCount: 0, lastSnapshot: null };
  }

  const matchingOrders = ordersList.filter(
    (o) => normalizeClienteEmail(String(o.customer_email ?? "")) === email
  );

  const pastOrdersCount = matchingOrders.length;
  if (pastOrdersCount === 0) {
    return { pastOrdersCount: 0, lastSnapshot: null };
  }

  const latest = matchingOrders[0];

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

  const clienteRow = await getClienteById(clienteId);
  const currentNombre = trimStr(clienteRow?.nombre);
  const currentTel = trimStr(clienteRow?.telefono);

  const patch: { nombre?: string; telefono?: string } = {};
  if (!currentNombre && orderNombre) patch.nombre = orderNombre;
  if (!currentTel && orderTel) patch.telefono = orderTel;

  if (Object.keys(patch).length) {
    try {
      await updateCliente(clienteId, patch);
    } catch (upCErr) {
      console.error("[recover-from-orders] update cliente", upCErr);
    }
  }

  const dirRows = await listDireccionesByClienteId(clienteId);
  const fpOrder = addressKey(ship.direccion, ship.comuna, ship.region);
  const hasConcreteAddr =
    ship.direccion.length >= 4 && ship.comuna.length >= 2 && ship.region.length >= 2;

  const rowFp = (r: (typeof dirRows)[number]) => addressKey(r.direccion, r.comuna, r.region);
  const hasDefault = dirRows.some((r) => r.is_default);
  const sameFpRow = dirRows.find((r) => rowFp(r) === fpOrder);

  if (hasConcreteAddr && fpOrder !== "||") {
    if (sameFpRow) {
      if (!hasDefault) {
        try {
          await updateDireccion(sameFpRow.id, clienteId, { is_default: true });
        } catch (e2) {
          console.error("[recover-from-orders] set default", e2);
        }
      }
    } else if (!hasDefault) {
      try {
        await createDireccion({
          cliente_id: clienteId,
          nombre: "Principal",
          direccion: ship.direccion,
          comuna: ship.comuna,
          region: ship.region,
          referencia: null,
          telefono: orderTel || null,
          is_default: true,
        });
      } catch (insE) {
        console.error("[recover-from-orders] insert dir", insE);
      }
    }
  }

  return { pastOrdersCount, lastSnapshot };
}
