import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { getAdminSessionFromCookies } from "@/lib/admin/session";
import { createAdminClient } from "@/lib/supabase/admin";

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

async function isLastActiveOwner(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  targetUserId: string
): Promise<boolean> {
  const { data, error } = await admin
    .from("admin_users")
    .select("id,role,active")
    .eq("id", targetUserId)
    .maybeSingle();
  if (error || !data) return false;
  if (data.role !== "owner" || data.active !== true) return false;

  const { count } = await admin
    .from("admin_users")
    .select("id", { count: "exact", head: true })
    .eq("role", "owner")
    .eq("active", true)
    .neq("id", targetUserId);

  return Number(count ?? 0) === 0;
}

export async function GET() {
  const session = getAdminSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (session.role !== "owner") {
    return NextResponse.json({ error: "Solo owner puede gestionar usuarios admin." }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data, error } = await admin
    .from("admin_users")
    .select("id,email,role,active,last_login_at,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: "No se pudieron cargar usuarios admin." }, { status: 500 });
  }
  return NextResponse.json({ users: data ?? [] });
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { error } = await admin.from("admin_users").insert({
    email,
    password_hash,
    role: parsed.data.role,
    active: parsed.data.active,
  });

  if (error) {
    if (String(error.code) === "23505") {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const currentlyLastOwner = await isLastActiveOwner(admin, parsed.data.id);
  const ownerWillLoseOwnerRole = parsed.data.role !== "owner";
  const ownerWillBeDisabled = parsed.data.active === false;
  if (currentlyLastOwner && (ownerWillLoseOwnerRole || ownerWillBeDisabled)) {
    return NextResponse.json({ error: "No puedes desactivar o quitar rol al último owner activo." }, { status: 400 });
  }

  const { error } = await admin
    .from("admin_users")
    .update({
      role: parsed.data.role,
      active: parsed.data.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);

  if (error) {
    return NextResponse.json({ error: "No se pudo actualizar el usuario admin." }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const });
}

