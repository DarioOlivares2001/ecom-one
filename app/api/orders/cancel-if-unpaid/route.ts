import { NextRequest, NextResponse } from "next/server";
import { getOrderByOrderNumber } from "@/lib/db/repositories/orders";
import { verifyFlowPaymentForOrder } from "@/lib/orders/verifyFlowPayment";

/**
 * Flow no envía urlConfirmation cuando el usuario cancela voluntariamente el
 * pago (vuelve atrás, cierra la pestaña). La orden queda zombie en
 * awaiting_payment. Este endpoint lo resuelve consultando a Flow el estado
 * real con el flow_token guardado en BD — nunca confía en lo que el cliente
 * dice, solo usa el order_number para encontrar el flow_token ya persistido.
 *
 * Delega en `verifyFlowPaymentForOrder` (compartida con el webhook y con la
 * verificación directa del retorno del navegador): si Flow reporta pagado,
 * la orden se confirma acá mismo — antes esta ruta solo se abstenía de
 * cancelar y la dejaba huérfana en `awaiting_payment` sin nunca confirmarla.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { order?: number | string };
    const orderNumber = Number(body.order);
    if (!Number.isFinite(orderNumber) || orderNumber <= 0) {
      return NextResponse.json({ ok: false, error: "order inválido" }, { status: 400 });
    }

    let orderRow;
    try {
      orderRow = await getOrderByOrderNumber(orderNumber);
    } catch (orderErr) {
      const message = orderErr instanceof Error ? orderErr.message : String(orderErr);
      console.error("[cancel-if-unpaid] error consultando orden", { orderNumber, error: message });
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
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

    const outcome = await verifyFlowPaymentForOrder(orderRow);

    // SEGURIDAD CRÍTICA: si Flow confirma pagado, se confirma la orden — nunca se cancela.
    if (outcome.status === "paid") {
      console.log("[cancel-if-unpaid] Flow reporta pagado, orden confirmada", { orderNumber });
      return NextResponse.json({ ok: true, action: "confirmed" });
    }

    if (outcome.needsManualReview) {
      console.error("[cancel-if-unpaid][CRITICAL] Flow confirmó el pago pero no se pudo registrar", {
        orderNumber,
        reason: outcome.technicalReason,
      });
      return NextResponse.json(
        { ok: false, error: "Flow confirmó el pago pero no se pudo registrar; requiere revisión manual" },
        { status: 500 }
      );
    }

    if (outcome.status === "cancelled") {
      console.log("[cancel-if-unpaid] orden cancelada", { orderNumber });
      return NextResponse.json({ ok: true, action: "cancelled" });
    }

    // Flow todavía reporta pendiente (status 1) — no se cancela, puede confirmarse después.
    return NextResponse.json({ ok: true, action: "none", reason: outcome.status });
  } catch (err) {
    console.error("[cancel-if-unpaid] excepción", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
