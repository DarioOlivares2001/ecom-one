import { NextResponse } from "next/server";
import { compareSync } from "bcryptjs";
import { z } from "zod";
import { getClienteByEmail } from "@/lib/db/repositories/clientes";
import { normalizeClienteEmail } from "@/lib/clientes/upsertClienteFromOrder";
import { setCuentaSessionCookie } from "@/lib/cuenta/session";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }

    const email = normalizeClienteEmail(parsed.data.email);
    const password = parsed.data.password;

    let cliente;
    try {
      cliente = await getClienteByEmail(email);
    } catch (error) {
      console.error("[cuenta-login] error select", error);
      return NextResponse.json({ error: "No se pudo iniciar sesión." }, { status: 500 });
    }

    if (!cliente || !cliente.password_hash || !cliente.registered_at) {
      return NextResponse.json(
        {
          error:
            "Cuenta no registrada. Crea una cuenta gratis o completa tu registro tras una compra.",
        },
        { status: 401 }
      );
    }

    const valid = compareSync(password, String(cliente.password_hash));
    if (!valid) {
      return NextResponse.json({ error: "Email o contraseña incorrectos." }, { status: 401 });
    }

    setCuentaSessionCookie(email);
    return NextResponse.json({
      ok: true as const,
      email,
      nombre: String(cliente.nombre ?? "Cliente"),
    });
  } catch (e) {
    console.error("[cuenta-login] excepción", e);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
