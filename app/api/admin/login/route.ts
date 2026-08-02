import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { getAdminUserByEmail, updateAdminUser } from "@/lib/db/repositories/adminUsers";
import { setAdminSessionCookie } from "@/lib/admin/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Credenciales inválidas." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;

  let row;
  try {
    row = await getAdminUserByEmail(email);
  } catch {
    return NextResponse.json({ error: "No se pudo validar credenciales." }, { status: 500 });
  }

  const matchedAdmin =
    row && row.active === true && typeof row.password_hash === "string"
      ? await compare(password, row.password_hash)
      : false;

  if (!matchedAdmin || !row) {
    return NextResponse.json({ error: "Email o contraseña incorrectos." }, { status: 401 });
  }

  setAdminSessionCookie({
    id: String(row.id),
    email: String(row.email),
    role: String(row.role ?? "admin"),
  });

  await updateAdminUser(row.id, { last_login_at: new Date().toISOString() });

  return NextResponse.json({ ok: true as const });
}

