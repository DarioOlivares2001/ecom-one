import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeClienteEmail } from "@/lib/clientes/upsertClienteFromOrder";
import { getCuentaSessionFromCookies } from "@/lib/cuenta/session";

export const runtime = "nodejs";

/**
 * Datos sugeridos para checkout (solo lectura). No modifica direcciones guardadas.
 */
export async function GET() {
  const session = getCuentaSessionFromCookies();
  if (!session?.email) {
    return NextResponse.json({ loggedIn: false as const });
  }

  const email = normalizeClienteEmail(session.email);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: cliente, error: cErr } = await admin
    .from("clientes")
    .select("id,nombre,email,telefono")
    .eq("email", email)
    .maybeSingle();

  if (cErr || !cliente) {
    return NextResponse.json({ loggedIn: true as const, cliente: null, defaultAddress: null });
  }

  const clienteId = String(cliente.id);
  const { data: dirs } = await admin
    .from("cliente_direcciones")
    .select("nombre,direccion,comuna,region,referencia,telefono,is_default")
    .eq("cliente_id", clienteId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  const list = Array.isArray(dirs) ? dirs : [];
  const def = list.find((d: { is_default?: boolean }) => d.is_default) ?? list[0] ?? null;

  return NextResponse.json({
    loggedIn: true as const,
    cliente: {
      name: String(cliente.nombre ?? "").trim(),
      email: String(cliente.email ?? email),
      phone: cliente.telefono != null ? String(cliente.telefono) : "",
    },
    defaultAddress: def
      ? {
          label: String(def.nombre ?? ""),
          address: String(def.direccion ?? ""),
          city: String(def.comuna ?? ""),
          region: String(def.region ?? ""),
          referencia: def.referencia != null ? String(def.referencia) : "",
          telefono: def.telefono != null ? String(def.telefono) : "",
        }
      : null,
  });
}
