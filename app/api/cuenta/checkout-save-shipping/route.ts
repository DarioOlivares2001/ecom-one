import { NextResponse } from "next/server";
import { z } from "zod";
import { getClienteByEmail, updateCliente } from "@/lib/db/repositories/clientes";
import {
  createDireccion,
  listDireccionesByClienteId,
  updateDireccion,
} from "@/lib/db/repositories/clienteDirecciones";
import { normalizeClienteEmail } from "@/lib/clientes/upsertClienteFromOrder";
import { getCuentaSessionFromCookies } from "@/lib/cuenta/session";

export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().min(9).max(40),
  address: z.string().min(5).max(240),
  city: z.string().min(2).max(120),
  region: z.string().min(1).max(120),
});

function addressKey(d: string, c: string, r: string): string {
  return `${d.trim().toLowerCase()}|${c.trim().toLowerCase()}|${r.trim().toLowerCase()}`;
}

export async function POST(request: Request) {
  const session = getCuentaSessionFromCookies();
  if (!session?.email) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const email = normalizeClienteEmail(session.email);
  const { name, phone, address, city, region } = parsed.data;

  const cliente = await getClienteByEmail(email);
  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
  }
  const clienteId = cliente.id;

  try {
    await updateCliente(clienteId, { nombre: name.trim(), telefono: phone.trim() });
  } catch (error) {
    console.error("[checkout-save-shipping] cliente", error);
    return NextResponse.json({ error: "No se pudo actualizar el perfil." }, { status: 500 });
  }

  const list = await listDireccionesByClienteId(clienteId);
  const fp = addressKey(address, city, region);
  const def = list.find((d) => d.is_default) ?? null;
  const same = list.find((d) => addressKey(d.direccion, d.comuna, d.region) === fp);

  try {
    if (def) {
      await updateDireccion(def.id, clienteId, {
        direccion: address.trim(),
        comuna: city.trim(),
        region: region.trim(),
        telefono: phone.trim(),
      });
    } else if (same) {
      await updateDireccion(same.id, clienteId, {
        direccion: address.trim(),
        comuna: city.trim(),
        region: region.trim(),
        telefono: phone.trim(),
        is_default: true,
      });
    } else {
      await createDireccion({
        cliente_id: clienteId,
        nombre: "Principal",
        direccion: address.trim(),
        comuna: city.trim(),
        region: region.trim(),
        referencia: null,
        telefono: phone.trim(),
        is_default: true,
      });
    }
  } catch (error) {
    console.error("[checkout-save-shipping] dir", error);
    return NextResponse.json({ error: "No se pudo guardar la dirección." }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const });
}
