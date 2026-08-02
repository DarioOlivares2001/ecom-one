import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const FLOW_API_URL = process.env.FLOW_API_URL ?? "https://sandbox.flow.cl/api";
const FLOW_API_KEY = process.env.FLOW_API_KEY ?? "";
const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY ?? "";

function sign(params: Record<string, string>, secret: string): string {
  const message = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

/**
 * Flow no envía urlConfirmation cuando el usuario cancela voluntariamente el
 * pago (vuelve atrás, cierra la pestaña). La orden queda zombie en
 * awaiting_payment. Este endpoint lo resuelve consultando a Flow el estado
 * real con el flow_token guardado en BD — nunca confía en lo que el cliente
 * dice, solo usa el order_number para encontrar el flow_token ya persistido.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { order?: number | string };
    const orderNumber = Number(body.order);
    if (!Number.isFinite(orderNumber) || orderNumber <= 0) {
      return NextResponse.json({ ok: false, error: "order inválido" }, { status: 400 });
    }

    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: orderRow, error: orderErr } = await (admin as any)
      .from("orders")
      .select("id, status, flow_token")
      .eq("order_number", orderNumber)
      .maybeSingle();

    if (orderErr) {
      console.error("[cancel-if-unpaid] error consultando orden", {
        orderNumber,
        error: orderErr.message,
      });
      return NextResponse.json({ ok: false, error: orderErr.message }, { status: 500 });
    }
    if (!orderRow) {
      return NextResponse.json({ ok: true, action: "none", reason: "orden no encontrada" });
    }

    // Idempotente: si ya no está awaiting_payment (paid, cancelled, etc.), nada que hacer.
    if (orderRow.status !== "awaiting_payment") {
      return NextResponse.json({ ok: true, action: "none", reason: orderRow.status });
    }

    const flowToken = String(orderRow.flow_token ?? "").trim();
    if (!flowToken || flowToken.startsWith("MOCK-")) {
      return NextResponse.json({ ok: true, action: "none", reason: "sin flow_token" });
    }
    if (!FLOW_API_KEY || !FLOW_SECRET_KEY) {
      return NextResponse.json(
        { ok: false, error: "Flow credentials not configured" },
        { status: 500 }
      );
    }

    // Verificar con Flow — la verdad la tiene Flow, no el cliente.
    const queryParams: Record<string, string> = { apiKey: FLOW_API_KEY, token: flowToken };
    queryParams.s = sign(queryParams, FLOW_SECRET_KEY);
    const flowRes = await fetch(
      `${FLOW_API_URL}/payment/getStatus?${new URLSearchParams(queryParams)}`,
      { method: "GET" }
    );
    const data = (await flowRes.json().catch(() => ({}))) as Record<string, unknown>;

    if (!flowRes.ok) {
      console.error("[cancel-if-unpaid] Flow getStatus error", {
        status: flowRes.status,
        orderNumber,
      });
      return NextResponse.json({ ok: false, error: "Flow API error" }, { status: 502 });
    }

    const flowStatus = Number(data.status);

    // SEGURIDAD CRÍTICA: nunca cancelar un pago que Flow confirma como pagado.
    if (flowStatus === 2) {
      return NextResponse.json({ ok: true, action: "none", reason: "paid" });
    }

    // Guard .eq("status", "awaiting_payment") evita pisar una orden ya paid
    // si hubo una carrera con el webhook real.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateErr } = await (admin as any)
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderRow.id)
      .eq("status", "awaiting_payment");

    if (updateErr) {
      console.error("[cancel-if-unpaid] DB error", { error: updateErr.message, orderNumber });
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
    }

    console.log("[cancel-if-unpaid] orden cancelada", { orderNumber, flowStatus });
    return NextResponse.json({ ok: true, action: "cancelled" });
  } catch (err) {
    console.error("[cancel-if-unpaid] excepción", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
