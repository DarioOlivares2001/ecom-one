import { NextResponse } from "next/server";
import { z } from "zod";
import { getClienteByEmail, updateCliente } from "@/lib/db/repositories/clientes";
import { normalizeClienteEmail } from "@/lib/clientes/upsertClienteFromOrder";
import {
  validateNombreCliente,
  validateTelefonoChileno,
  validateRutCampos,
} from "@/lib/clientes/datosClienteValidators";
import { rutParaGuardar } from "@/lib/clientes/rutChileno";
import { getCuentaSessionFromCookies } from "@/lib/cuenta/session";

export const runtime = "nodejs";

const putSchema = z.object({
  nombre: z.string().max(120),
  telefono: z.string().max(40).optional().nullable(),
  rut_numero: z.string().max(12).optional().nullable(),
  rut_dv: z.string().max(1).optional().nullable(),
});

export async function GET() {
  const session = getCuentaSessionFromCookies();
  if (!session?.email) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const email = normalizeClienteEmail(session.email);
  const data = await getClienteByEmail(email);

  if (!data) {
    return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    nombre: String(data.nombre ?? ""),
    email: String(data.email ?? ""),
    telefono: data.telefono != null ? String(data.telefono) : "",
    rut_numero: data.rut_numero != null ? String(data.rut_numero) : "",
    rut_dv: data.rut_dv != null ? String(data.rut_dv) : "",
  });
}

export async function PUT(request: Request) {
  const session = getCuentaSessionFromCookies();
  if (!session?.email) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const email = normalizeClienteEmail(session.email);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const nombreTrim = String(parsed.data.nombre ?? "").trim();
  const nombreErr = validateNombreCliente(nombreTrim);
  if (nombreErr) {
    return NextResponse.json({ error: nombreErr }, { status: 400 });
  }

  const telRaw =
    parsed.data.telefono == null || parsed.data.telefono === undefined
      ? ""
      : String(parsed.data.telefono);
  const telErr = validateTelefonoChileno(telRaw);
  if (telErr) {
    return NextResponse.json({ error: telErr }, { status: 400 });
  }

  const rutNum = parsed.data.rut_numero != null ? String(parsed.data.rut_numero).trim() : "";
  const rutDv = parsed.data.rut_dv != null ? String(parsed.data.rut_dv).trim() : "";
  const rutFieldErr = validateRutCampos(rutNum, rutDv);
  if (rutFieldErr.rut_numero) {
    return NextResponse.json({ error: rutFieldErr.rut_numero }, { status: 400 });
  }
  if (rutFieldErr.rut_dv) {
    return NextResponse.json({ error: rutFieldErr.rut_dv }, { status: 400 });
  }

  const telefono = telRaw.trim();

  let rut_numero: string | null = null;
  let rut_dv: string | null = null;
  if (rutNum && rutDv) {
    const g = rutParaGuardar(rutNum, rutDv);
    rut_numero = g.rut_numero;
    rut_dv = g.rut_dv;
  }

  const existing = await getClienteByEmail(email);
  if (!existing) {
    return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
  }

  try {
    await updateCliente(existing.id, {
      nombre: nombreTrim,
      telefono,
      rut_numero,
      rut_dv,
    });
  } catch (error) {
    console.error("[cuenta-datos] update", error);
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const });
}
