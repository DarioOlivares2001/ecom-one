import { NextResponse } from "next/server";
import { hashSync } from "bcryptjs";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;

    const { data: row, error: selErr } = await admin
      .from("clientes")
      .select("id,password_hash,nombre")
      .eq("email", normEmail)
      .maybeSingle();

    if (selErr) {
      console.error("[cuenta-registro-public] select", selErr.message);
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
      const { error: upErr } = await admin
        .from("clientes")
        .update({
          nombre: nombreFinal,
          telefono,
          password_hash: hashPw,
          registered_at: nowIso,
        })
        .eq("email", normEmail);

      if (upErr) {
        console.error("[cuenta-registro-public] update", upErr.message);
        return NextResponse.json({ error: "No se pudo completar el registro." }, { status: 500 });
      }
    } else {
      const { error: insErr } = await admin.from("clientes").insert({
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

      if (insErr) {
        if (insErr.code === "23505") {
          const { data: row2, error: sel2 } = await admin
            .from("clientes")
            .select("password_hash,nombre")
            .eq("email", normEmail)
            .maybeSingle();
          if (sel2 || !row2) {
            return NextResponse.json({ error: "No se pudo completar el registro." }, { status: 500 });
          }
          if (row2.password_hash) {
            return NextResponse.json(
              { error: "Ya existe una cuenta con este correo." },
              { status: 409 }
            );
          }
          const nombreFinal = nombre || String(row2.nombre ?? "").trim() || "Cliente";
          const { error: up2 } = await admin
            .from("clientes")
            .update({
              nombre: nombreFinal,
              telefono,
              password_hash: hashPw,
              registered_at: nowIso,
            })
            .eq("email", normEmail);
          if (up2) {
            console.error("[cuenta-registro-public] update tras duplicado", up2.message);
            return NextResponse.json({ error: "No se pudo completar el registro." }, { status: 500 });
          }
        } else {
          console.error("[cuenta-registro-public] insert", insErr.message);
          return NextResponse.json({ error: "No se pudo completar el registro." }, { status: 500 });
        }
      }
    }

    const { data: clienteAfter } = await admin
      .from("clientes")
      .select("id")
      .eq("email", normEmail)
      .maybeSingle();

    let recoveryHadPastOrders = false;
    if (clienteAfter?.id) {
      const rec = await recoverClienteFromOrderHistory(admin, String(clienteAfter.id), normEmail);
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
