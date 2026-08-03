import { NextResponse } from "next/server";
import { z } from "zod";
import { getClienteByEmail } from "@/lib/db/repositories/clientes";
import {
  deleteDireccion,
  getDireccionById,
  updateDireccion,
} from "@/lib/db/repositories/clienteDirecciones";
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

const patchSchema = z.object({
  nombre: z.string().min(1).max(120).optional(),
  direccion: z.string().min(3).max(300).optional(),
  comuna: z.string().min(1).max(120).optional(),
  region: z.string().min(1).max(120).optional(),
  referencia: z.string().max(300).optional().nullable(),
  telefono: z.string().max(40).optional().nullable(),
  is_default: z.boolean().optional(),
});

async function assertOwnDireccion(
  email: string,
  direccionId: string
): Promise<{ ok: true; clienteId: string } | { ok: false; status: number; message: string }> {
  const norm = normalizeClienteEmail(email);
  const cliente = await getClienteByEmail(norm);
  if (!cliente) return { ok: false, status: 404, message: "Cliente no encontrado." };
  const direccion = await getDireccionById(direccionId);
  if (!direccion || direccion.cliente_id !== cliente.id) {
    return { ok: false, status: 404, message: "Dirección no encontrada." };
  }
  return { ok: true, clienteId: cliente.id };
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = getCuentaSessionFromCookies();
  if (!session?.email) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const id = String(params.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  let body: AddressPayload;
  try {
    body = (await request.json()) as AddressPayload;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse({
    ...body,
    is_default:
      typeof body.principal === "boolean" ? body.principal : typeof body.is_default === "boolean" ? body.is_default : undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const own = await assertOwnDireccion(session.email, id);
  if (!own.ok) {
    return NextResponse.json({ error: own.message }, { status: own.status });
  }

  const p = parsed.data;
  const patch: {
    nombre?: string;
    direccion?: string;
    comuna?: string;
    region?: string;
    referencia?: string | null;
    telefono?: string | null;
    is_default?: boolean;
  } = {};
  if (p.nombre != null) patch.nombre = p.nombre.trim();
  if (p.direccion != null) patch.direccion = p.direccion.trim();
  if (p.comuna != null) patch.comuna = p.comuna.trim();
  if (p.region != null) patch.region = p.region.trim();
  if (p.referencia !== undefined) patch.referencia = p.referencia?.trim() || null;
  if (p.telefono !== undefined) patch.telefono = p.telefono?.trim() || null;
  if ("is_default" in parsed.data) {
    patch.is_default = p.is_default === true;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true as const });
  }

  try {
    await updateDireccion(id, own.clienteId, patch);
  } catch (error) {
    console.error("[cuenta-direcciones] patch", error);
    return NextResponse.json({ error: "No se pudo actualizar." }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = getCuentaSessionFromCookies();
  if (!session?.email) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const id = String(params.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const own = await assertOwnDireccion(session.email, id);
  if (!own.ok) {
    return NextResponse.json({ error: own.message }, { status: own.status });
  }

  try {
    await deleteDireccion(id, own.clienteId);
  } catch (error) {
    console.error("[cuenta-direcciones] delete", error);
    return NextResponse.json({ error: "No se pudo eliminar." }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const });
}
