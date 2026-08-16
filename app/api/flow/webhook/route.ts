import { NextRequest, NextResponse } from "next/server";
import {
  getOrderByDisplayCode,
  getOrderByOrderNumber,
} from "@/lib/db/repositories/orders";
import { FLOW_API_KEY, FLOW_SECRET_KEY } from "@/lib/flow/config";
import { getFlowPaymentStatus } from "@/lib/flow/getPaymentStatus";
import { applyFlowStatusToOrder } from "@/lib/orders/verifyFlowPayment";

/**
 * Webhook de confirmación de Flow.
 *
 * Flujo:
 *  1. Flow nos envía `token` (POST x-www-form-urlencoded).
 *  2. Consultamos `payment/getStatus` con `apiKey` + `token` firmado — nunca
 *     confiamos en el body del webhook en sí.
 *  3. Buscamos la orden por el `commerceOrder` que Flow devuelve.
 *  4. Delegamos la confirmación/cancelación idempotente en
 *     `applyFlowStatusToOrder` (compartida con la verificación directa en
 *     el retorno del navegador y con `cancel-if-unpaid`).
 *
 * Para evitar reintentos infinitos de Flow ante errores transitorios,
 * siempre respondemos 200 salvo error de protocolo (body inválido).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.formData();
    const token = String(body.get("token") ?? "").trim();
    if (!token) {
      console.warn("[flow-webhook] body sin token");
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    if (!FLOW_API_KEY || !FLOW_SECRET_KEY) {
      console.error("[flow-webhook] credenciales Flow no configuradas");
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // ── 1. Consultar estado del pago a Flow ─────────────────────────────────
    const flowRes = await getFlowPaymentStatus(token);

    if (!flowRes.ok) {
      console.error("[flow-webhook] getStatus respondió error", {
        status: flowRes.httpStatus,
        body: flowRes.raw,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const { statusCode, commerceOrder } = flowRes;

    if (!commerceOrder) {
      console.warn("[flow-webhook] commerceOrder vacío");
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // ── 2. Buscar la orden ──────────────────────────────────────────────────
    // Busca por display_code (formato nuevo SO...).
    // Fallback a order_number parseado desde "TG-X" para órdenes en vuelo
    // creadas con el formato anterior. Eliminar fallback cuando no queden pendientes viejas.
    let orderRow;
    try {
      orderRow = await getOrderByDisplayCode(commerceOrder);

      if (!orderRow && commerceOrder.startsWith("TG-")) {
        const legacyNum = Number(commerceOrder.slice(3));
        if (Number.isFinite(legacyNum) && legacyNum > 0) {
          orderRow = await getOrderByOrderNumber(legacyNum);
        }
      }
    } catch (orderErr) {
      console.error("[flow-webhook] error consultando orden", {
        commerceOrder,
        error: orderErr,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }
    if (!orderRow) {
      console.warn("[flow-webhook] orden no encontrada", { commerceOrder });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // ── 3. Aplicar confirmación/cancelación idempotente ─────────────────────
    // Flow status:  1 → pendiente  2 → pagado  3 → rechazado  4 → cancelado
    const outcome = await applyFlowStatusToOrder(orderRow, statusCode);

    if (outcome.needsManualReview) {
      console.error("[flow-webhook][CRITICAL] pago confirmado por Flow pero no se pudo registrar", {
        commerceOrder,
        orderId: orderRow.id,
        reason: outcome.technicalReason,
      });
    } else {
      console.log("[flow-webhook] resultado aplicado", {
        commerceOrder,
        orderId: orderRow.id,
        status: outcome.status,
        justConfirmedPaid: outcome.justConfirmedPaid,
      });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("[flow-webhook] excepción", err);
    return NextResponse.json({ error: "Error en webhook" }, { status: 500 });
  }
}
