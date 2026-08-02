import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { getAdminSessionFromCookies } from "@/lib/admin/session";
import { updateAdminUser } from "@/lib/db/repositories/adminUsers";

const schema = z.object({
  id: z.string().uuid(),
  password: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres."),
});

export async function POST(request: Request) {
  const session = getAdminSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (session.role !== "owner") {
    return NextResponse.json({ error: "Solo owner puede resetear contraseñas admin." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const password_hash = await hash(parsed.data.password, 12);

  try {
    await updateAdminUser(parsed.data.id, { password_hash });
  } catch {
    return NextResponse.json({ error: "No se pudo resetear la contraseña." }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const });
}

