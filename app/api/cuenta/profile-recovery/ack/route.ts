import { NextResponse } from "next/server";
import { getClienteByEmail, updateCliente } from "@/lib/db/repositories/clientes";
import { normalizeClienteEmail } from "@/lib/clientes/normalizeClienteEmail";
import { getCuentaSessionFromCookies } from "@/lib/cuenta/session";

export const runtime = "nodejs";

export async function POST() {
  const session = getCuentaSessionFromCookies();
  if (!session?.email) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const email = normalizeClienteEmail(session.email);
  const nowIso = new Date().toISOString();

  try {
    const cliente = await getClienteByEmail(email);
    if (!cliente) {
      return NextResponse.json({ error: "No se pudo guardar." }, { status: 404 });
    }
    await updateCliente(cliente.id, { profile_recovery_ack_at: nowIso });
  } catch (error) {
    console.error("[profile-recovery-ack]", error);
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const });
}
