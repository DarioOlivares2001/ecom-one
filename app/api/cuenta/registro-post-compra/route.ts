import { NextResponse } from "next/server";
import { hashSync } from "bcryptjs";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeClienteEmail } from "@/lib/clientes/upsertClienteFromOrder";
import { recoverClienteFromOrderHistory } from "@/lib/clientes/recoverFromOrderHistory";
import { sendWelcomeEmail } from "@/lib/email/sendWelcomeEmail";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  order: z.coerce.number().int().positive(),
});

function emailsMatch(orderEmail: string, inputEmail: string): boolean {
  return normalizeClienteEmail(orderEmail) === normalizeClienteEmail(inputEmail);
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }

    const { email, password, order } = parsed.data;
    const normEmail = normalizeClienteEmail(email);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { data: orderRow, error: orderErr } = await admin
      .from("orders")
      .select("customer_email, customer_name")
      .eq("order_number", order)
      .maybeSingle();

    if (orderErr || !orderRow?.customer_email) {
      console.error("[cuenta-registro] error orden", orderErr?.message ?? "sin fila");
      return NextResponse.json({ error: "No pudimos validar tu pedido." }, { status: 400 });
    }

    if (!emailsMatch(orderRow.customer_email, normEmail)) {
      return NextResponse.json({ error: "El email no coincide con el pedido." }, { status: 403 });
    }

    const nombre = (orderRow.customer_name || "").trim() || "Cliente";
    const hashPw = hashSync(password, 12);
    const nowIso = new Date().toISOString();

    const { data: existing, error: selErr } = await admin
      .from("clientes")
      .select("id,password_hash")
      .eq("email", normEmail)
      .maybeSingle();

    if (selErr) {
      console.error("[cuenta-registro] select cliente", selErr.message);
      return NextResponse.json({ error: "Error al guardar la cuenta." }, { status: 500 });
    }

    if (existing?.password_hash) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con este correo. Inicia sesión." },
        { status: 409 }
      );
    }

    if (existing) {
      const { error: upErr } = await admin
        .from("clientes")
        .update({ password_hash: hashPw, registered_at: nowIso })
        .eq("email", normEmail);
      if (upErr) {
        console.error("[cuenta-registro] update", upErr.message);
        return NextResponse.json({ error: "Error al guardar la cuenta." }, { status: 500 });
      }
    } else {
      const { error: insErr } = await admin.from("clientes").insert({
        email: normEmail,
        nombre,
        telefono: null,
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
          const { error: up2 } = await admin
            .from("clientes")
            .update({ password_hash: hashPw, registered_at: nowIso })
            .eq("email", normEmail);
          if (up2) {
            console.error("[cuenta-registro] update tras duplicado", up2.message);
            return NextResponse.json({ error: "Error al guardar la cuenta." }, { status: 500 });
          }
        } else {
          console.error("[cuenta-registro] insert", insErr.message);
          return NextResponse.json({ error: "Error al guardar la cuenta." }, { status: 500 });
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

    try {
      await sendWelcomeEmail({
        to: normEmail,
        customerName: nombre,
        storeName: settings.store_name,
      });
    } catch (e) {
      console.error("[cuenta-registro] email bienvenida", e);
    }

    console.log("[cuenta-registro] ok", { email: normEmail, order });

    return NextResponse.json({
      ok: true as const,
      nombre,
      storeName: settings.store_name,
      recoveryHadPastOrders,
    });
  } catch (e) {
    console.error("[cuenta-registro] excepción", e);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
