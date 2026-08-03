import { NextResponse } from "next/server";
import { z } from "zod";
import { getClienteByEmail } from "@/lib/db/repositories/clientes";
import { createDireccion, listDireccionesByClienteId } from "@/lib/db/repositories/clienteDirecciones";
import { normalizeClienteEmail } from "@/lib/clientes/normalizeClienteEmail";
import { getCuentaSessionFromCookies } from "@/lib/cuenta/session";

export const runtime = "nodejs";

type AddressPayload = {
  nombre?: string;
  telefono?: string;
  direccion?: string;
  comuna?: string;
  region?: string;
  referencia?: string;
  principal?: boolean;
  is_default?: boolean;
};

const postSchema = z.object({
  nombre: z.string().min(1).max(120),
  direccion: z.string().min(3).max(300),
  comuna: z.string().min(1).max(120),
  region: z.string().min(1).max(120),
  referencia: z.string().max(300).optional().nullable(),
  telefono: z.string().max(40).optional().nullable(),
  is_default: z.boolean().optional(),
});

async function getClienteId(email: string): Promise<string | null> {
  try {
    const cliente = await getClienteByEmail(email);
    return cliente?.id ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const session = getCuentaSessionFromCookies();
  if (!session?.email) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const email = normalizeClienteEmail(session.email);
  const clienteId = await getClienteId(email);
  if (!clienteId) {
    return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
  }

  try {
    const direcciones = await listDireccionesByClienteId(clienteId);
    return NextResponse.json({ direcciones });
  } catch (error) {
    console.error("[cuenta-direcciones] list", error);
    return NextResponse.json({ error: "No se pudieron cargar las direcciones." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = getCuentaSessionFromCookies();
  if (!session?.email) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const email = normalizeClienteEmail(session.email);
  let body: AddressPayload;
  try {
    body = (await request.json()) as AddressPayload;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const parsed = postSchema.safeParse({
    ...body,
    is_default:
      typeof body.principal === "boolean" ? body.principal : typeof body.is_default === "boolean" ? body.is_default : undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const clienteId = await getClienteId(email);
  if (!clienteId) {
    return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
  }

  const d = parsed.data;

  try {
    const inserted = await createDireccion({
      cliente_id: clienteId,
      nombre: d.nombre.trim(),
      direccion: d.direccion.trim(),
      comuna: d.comuna.trim(),
      region: d.region.trim(),
      referencia: d.referencia?.trim() || null,
      telefono: d.telefono?.trim() || null,
      is_default: Boolean(d.is_default),
    });
    return NextResponse.json({ ok: true as const, id: inserted.id });
  } catch (error) {
    console.error("[cuenta-direcciones] insert", error);
    return NextResponse.json({ error: "No se pudo crear la dirección." }, { status: 500 });
  }
}
