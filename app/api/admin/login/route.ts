import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: row, error } = await admin
    .from("admin_users")
    .select("id,email,password_hash,role,active")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "No se pudo validar credenciales." }, { status: 500 });
  }

  const matchedAdmin =
    row && row.active === true && typeof row.password_hash === "string"
      ? await compare(password, row.password_hash)
      : false;

  if (!matchedAdmin) {
    return NextResponse.json({ error: "Email o contraseña incorrectos." }, { status: 401 });
  }

  setAdminSessionCookie({
    id: String(row.id),
    email: String(row.email),
    role: String(row.role ?? "admin"),
  });

  await admin
    .from("admin_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", row.id);

  return NextResponse.json({ ok: true as const });
}

