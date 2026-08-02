import { NextResponse } from "next/server";
import { hashSync } from "bcryptjs";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().min(1).max(200),
  password: z.string().min(8).max(72),
});

const GENERIC_ERR = "El enlace no es válido o expiró. Solicita uno nuevo desde «Olvidé mi contraseña».";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }

    const { token, password } = parsed.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { data: row, error: selErr } = await admin
      .from("clientes")
      .select("id,email,reset_token,reset_token_expires")
      .eq("reset_token", token)
      .maybeSingle();

    if (selErr) {
      console.error("[cuenta-reset] select", selErr.message);
      return NextResponse.json({ error: GENERIC_ERR }, { status: 400 });
    }

    if (!row?.reset_token_expires || String(row.reset_token ?? "") !== token) {
      return NextResponse.json({ error: GENERIC_ERR }, { status: 400 });
    }

    const expMs = new Date(String(row.reset_token_expires)).getTime();
    if (Number.isNaN(expMs) || expMs < Date.now()) {
      return NextResponse.json({ error: GENERIC_ERR }, { status: 400 });
    }

    const hashPw = hashSync(password, 12);
    const { error: upErr } = await admin
      .from("clientes")
      .update({
        password_hash: hashPw,
        reset_token: null,
        reset_token_expires: null,
      })
      .eq("id", row.id);

    if (upErr) {
      console.error("[cuenta-reset] update", upErr.message);
      return NextResponse.json({ error: "No se pudo actualizar la contraseña." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true as const,
      email: String(row.email ?? ""),
    });
  } catch (e) {
    console.error("[cuenta-reset] excepción", e);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
