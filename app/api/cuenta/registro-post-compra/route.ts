import { NextResponse } from "next/server";
import { hashSync } from "bcryptjs";
import { z } from "zod";
import { createCliente, getClienteByEmail, updateCliente } from "@/lib/db/repositories/clientes";
import { getOrderByOrderNumber } from "@/lib/db/repositories/orders";
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

    let orderRow;
    try {
      orderRow = await getOrderByOrderNumber(order);
    } catch (orderErr) {
      console.error("[cuenta-registro] error orden", orderErr);
      return NextResponse.json({ error: "No pudimos validar tu pedido." }, { status: 400 });
    }
    if (!orderRow?.customer_email) {
      console.error("[cuenta-registro] error orden", "sin fila");
      return NextResponse.json({ error: "No pudimos validar tu pedido." }, { status: 400 });
    }

    if (!emailsMatch(orderRow.customer_email, normEmail)) {
      return NextResponse.json({ error: "El email no coincide con el pedido." }, { status: 403 });
    }

    const nombre = (orderRow.customer_name || "").trim() || "Cliente";
    const hashPw = hashSync(password, 12);
    const nowIso = new Date().toISOString();

    let existing;
    try {
      existing = await getClienteByEmail(normEmail);
    } catch (selErr) {
      console.error("[cuenta-registro] select cliente", selErr);
      return NextResponse.json({ error: "Error al guardar la cuenta." }, { status: 500 });
    }

    if (existing?.password_hash) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con este correo. Inicia sesión." },
        { status: 409 }
      );
    }

    if (existing) {
      try {
        await updateCliente(existing.id, { password_hash: hashPw, registered_at: nowIso });
      } catch (upErr) {
        console.error("[cuenta-registro] update", upErr);
        return NextResponse.json({ error: "Error al guardar la cuenta." }, { status: 500 });
      }
    } else {
      try {
        await createCliente({
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
      } catch (insErr) {
        const code = (insErr as { code?: string } | null)?.code;
        if (code === "23505") {
          const row2 = await getClienteByEmail(normEmail);
          if (row2) {
            try {
              await updateCliente(row2.id, { password_hash: hashPw, registered_at: nowIso });
            } catch (up2) {
              console.error("[cuenta-registro] update tras duplicado", up2);
              return NextResponse.json({ error: "Error al guardar la cuenta." }, { status: 500 });
            }
          }
        } else {
          console.error("[cuenta-registro] insert", insErr);
          return NextResponse.json({ error: "Error al guardar la cuenta." }, { status: 500 });
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
