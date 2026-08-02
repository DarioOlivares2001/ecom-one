import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: cliente, error: cErr } = await admin
    .from("clientes")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (cErr || !cliente?.id) {
    return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
  }

  const clienteId = String(cliente.id);

  const { error: upCliente } = await admin
    .from("clientes")
    .update({
      nombre: name.trim(),
      telefono: phone.trim(),
    })
    .eq("id", clienteId);

  if (upCliente) {
    console.error("[checkout-save-shipping] cliente", upCliente.message);
    return NextResponse.json({ error: "No se pudo actualizar el perfil." }, { status: 500 });
  }

  const { data: dirs } = await admin
    .from("cliente_direcciones")
    .select("id, direccion, comuna, region, is_default")
    .eq("cliente_id", clienteId);

  const list = Array.isArray(dirs) ? dirs : [];
  const fp = addressKey(address, city, region);
  const def = list.find((d: { is_default?: boolean }) => d.is_default) ?? null;
  const same = list.find(
    (d: { direccion: string; comuna: string; region: string }) =>
      addressKey(String(d.direccion), String(d.comuna), String(d.region)) === fp
  );

  async function clearDefaults(): Promise<void> {
    await admin.from("cliente_direcciones").update({ is_default: false }).eq("cliente_id", clienteId);
  }

  if (def) {
    const { error: upD } = await admin
      .from("cliente_direcciones")
      .update({
        direccion: address.trim(),
        comuna: city.trim(),
        region: region.trim(),
        telefono: phone.trim(),
      })
      .eq("id", def.id);
    if (upD) {
      console.error("[checkout-save-shipping] dir", upD.message);
      return NextResponse.json({ error: "No se pudo actualizar la dirección." }, { status: 500 });
    }
  } else if (same) {
    await clearDefaults();
    const { error: upS } = await admin
      .from("cliente_direcciones")
      .update({
        direccion: address.trim(),
        comuna: city.trim(),
        region: region.trim(),
        telefono: phone.trim(),
        is_default: true,
      })
      .eq("id", same.id);
    if (upS) {
      console.error("[checkout-save-shipping] dir same", upS.message);
      return NextResponse.json({ error: "No se pudo actualizar la dirección." }, { status: 500 });
    }
  } else {
    await clearDefaults();
    const { error: ins } = await admin.from("cliente_direcciones").insert({
      cliente_id: clienteId,
      nombre: "Principal",
      direccion: address.trim(),
      comuna: city.trim(),
      region: region.trim(),
      referencia: null,
      telefono: phone.trim(),
      is_default: true,
    });
    if (ins) {
      console.error("[checkout-save-shipping] insert", ins.message);
      return NextResponse.json({ error: "No se pudo guardar la dirección." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true as const });
}
