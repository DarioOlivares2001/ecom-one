import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { getAdminSessionFromCookies } from "@/lib/admin/session";
import {
  countActiveOwners,
  createAdminUser,
  getAdminUserById,
  listAdminUsers,
  updateAdminUser,
} from "@/lib/db/repositories/adminUsers";

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "La contraseña temporal debe tener al menos 8 caracteres."),
  role: z.enum(["owner", "admin", "operator"]),
  active: z.boolean().default(true),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["owner", "admin", "operator"]),
  active: z.boolean(),
});

async function isLastActiveOwner(targetUserId: string): Promise<boolean> {
  const data = await getAdminUserById(targetUserId);
  if (!data) return false;
  if (data.role !== "owner" || data.active !== true) return false;

  const remainingActiveOwners = await countActiveOwners(targetUserId);
  return remainingActiveOwners === 0;
}

export async function GET() {
  const session = getAdminSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (session.role !== "owner") {
    return NextResponse.json({ error: "Solo owner puede gestionar usuarios admin." }, { status: 403 });
  }

  try {
    const data = await listAdminUsers();
    return NextResponse.json({ users: data });
  } catch {
    return NextResponse.json({ error: "No se pudieron cargar usuarios admin." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = getAdminSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (session.role !== "owner") {
    return NextResponse.json({ error: "Solo owner puede crear usuarios admin." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const password_hash = await hash(parsed.data.password, 12);

  try {
    await createAdminUser({
      email,
      password_hash,
      role: parsed.data.role,
      active: parsed.data.active,
    });
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "23505") {
      return NextResponse.json({ error: "Ya existe un admin con ese email." }, { status: 409 });
    }
    return NextResponse.json({ error: "No se pudo crear el usuario admin." }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const });
}

export async function PATCH(request: Request) {
  const session = getAdminSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (session.role !== "owner") {
    return NextResponse.json({ error: "Solo owner puede editar roles/admins." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const currentlyLastOwner = await isLastActiveOwner(parsed.data.id);
  const ownerWillLoseOwnerRole = parsed.data.role !== "owner";
  const ownerWillBeDisabled = parsed.data.active === false;
  if (currentlyLastOwner && (ownerWillLoseOwnerRole || ownerWillBeDisabled)) {
    return NextResponse.json({ error: "No puedes desactivar o quitar rol al último owner activo." }, { status: 400 });
  }

  try {
    await updateAdminUser(parsed.data.id, {
      role: parsed.data.role,
      active: parsed.data.active,
    });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar el usuario admin." }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const });
}

