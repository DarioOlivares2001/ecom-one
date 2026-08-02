import { NextResponse } from "next/server";
import { getClienteByEmail } from "@/lib/db/repositories/clientes";
import { listDireccionesByClienteId } from "@/lib/db/repositories/clienteDirecciones";
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
  const cliente = await getClienteByEmail(email);

  if (!cliente) {
    return NextResponse.json({ loggedIn: true as const, cliente: null, defaultAddress: null });
  }

  // listDireccionesByClienteId ya ordena is_default desc, created_at asc.
  const list = await listDireccionesByClienteId(cliente.id);
  const def = list.find((d) => d.is_default) ?? list[0] ?? null;

  return NextResponse.json({
    loggedIn: true as const,
    cliente: {
      name: String(cliente.nombre ?? "").trim(),
      email: cliente.email ?? email,
      phone: cliente.telefono ?? "",
    },
    defaultAddress: def
      ? {
          label: def.nombre,
          address: def.direccion,
          city: def.comuna,
          region: def.region,
          referencia: def.referencia ?? "",
          telefono: def.telefono ?? "",
        }
      : null,
  });
}
