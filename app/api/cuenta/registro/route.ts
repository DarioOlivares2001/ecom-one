import { NextResponse } from "next/server";
import { hashSync } from "bcryptjs";
import { z } from "zod";
import { createCliente, getClienteByEmail, updateCliente } from "@/lib/db/repositories/clientes";
import { normalizeClienteEmail } from "@/lib/clientes/upsertClienteFromOrder";
import { recoverClienteFromOrderHistory } from "@/lib/clientes/recoverFromOrderHistory";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";

export const runtime = "nodejs";

const bodySchema = z.object({
  nombre: z.string().min(2, "Ingresa tu nombre").max(120),
  email: z.string().email(),
  telefono: z.string().max(40).optional().nullable(),
  password: z.string().min(8).max(72),
});

function trimOrNull(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t.length ? t : null;
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }

    const normEmail = normalizeClienteEmail(parsed.data.email);
    const nombre = String(parsed.data.nombre).trim();
    const telefono = trimOrNull(parsed.data.telefono ?? undefined);
    const hashPw = hashSync(parsed.data.password, 12);
    const nowIso = new Date().toISOString();

    let row;
    try {
      row = await getClienteByEmail(normEmail);
    } catch (selErr) {
      console.error("[cuenta-registro-public] select", selErr);
      return NextResponse.json({ error: "No se pudo completar el registro." }, { status: 500 });
    }

    if (row?.password_hash) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con este correo." },
        { status: 409 }
      );
    }

    if (row) {
      const nombreFinal = nombre || String(row.nombre ?? "").trim() || "Cliente";
      try {
        await updateCliente(row.id, {
          nombre: nombreFinal,
          telefono,
          password_hash: hashPw,
          registered_at: nowIso,
        });
      } catch (upErr) {
        console.error("[cuenta-registro-public] update", upErr);
        return NextResponse.json({ error: "No se pudo completar el registro." }, { status: 500 });
      }
    } else {
      try {
        await createCliente({
          email: normEmail,
          nombre: nombre || "Cliente",
          telefono,
          direccion: null,
          comuna: null,
          rut_numero: null,
          rut_dv: null,
          total_orders: 0,
          total_spent: 0,
          last_order_at: null,
          password_hash: hashPw,
          registered_at: nowIso,
        });
      } catch (insErr) {
        const code = (insErr as { code?: string } | null)?.code;
        if (code === "23505") {
          const row2 = await getClienteByEmail(normEmail);
          if (!row2) {
            return NextResponse.json({ error: "No se pudo completar el registro." }, { status: 500 });
          }
          if (row2.password_hash) {
            return NextResponse.json(
              { error: "Ya existe una cuenta con este correo." },
              { status: 409 }
            );
          }
          const nombreFinal = nombre || String(row2.nombre ?? "").trim() || "Cliente";
          try {
            await updateCliente(row2.id, {
              nombre: nombreFinal,
              telefono,
              password_hash: hashPw,
              registered_at: nowIso,
            });
          } catch (up2) {
            console.error("[cuenta-registro-public] update tras duplicado", up2);
            return NextResponse.json({ error: "No se pudo completar el registro." }, { status: 500 });
          }
        } else {
          console.error("[cuenta-registro-public] insert", insErr);
          return NextResponse.json({ error: "No se pudo completar el registro." }, { status: 500 });
        }
      }
    }

    const clienteAfter = await getClienteByEmail(normEmail);

    let recoveryHadPastOrders = false;
    if (clienteAfter?.id) {
      const rec = await recoverClienteFromOrderHistory(clienteAfter.id, normEmail);
      recoveryHadPastOrders = rec.pastOrdersCount > 0;
    }

    const settings = await getStoreSettings();
    return NextResponse.json({
      ok: true as const,
      nombre: nombre || "Cliente",
      storeName: settings.store_name,
      recoveryHadPastOrders,
    });
  } catch (e) {
    console.error("[cuenta-registro-public] excepción", e);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
