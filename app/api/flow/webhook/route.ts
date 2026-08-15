import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  getOrderByDisplayCode,
  getOrderById,
  getOrderByOrderNumber,
  updateOrderIfStatus,
} from "@/lib/db/repositories/orders";
import { confirmPaidOrderAndDecrementStock } from "@/lib/orders/confirmPaidAndDecrementStock";
import { revalidateAfterStockChange } from "@/lib/orders/revalidateAfterStockChange";
import { sendOrderNotification } from "@/lib/email/sendOrderNotification";
import { sendMetaCapiPurchase } from "@/lib/pixel/capi";
import { getPublicSiteUrl } from "@/lib/site-url";
import { FLOW_API_KEY, FLOW_API_URL, FLOW_SECRET_KEY } from "@/lib/flow/config";

/**
 * HMAC-SHA256 sobre claves ordenadas (mismo esquema que /payment/create).
 */
function sign(params: Record<string, string>, secret: string): string {
  const message = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}


/**
 * Webhook de confirmación de Flow.
 *
 * Flujo:
 *  1. Flow nos envía `token` (POST x-www-form-urlencoded).
 *  2. Consultamos `payment/getStatus` con `apiKey` + `token` firmado.
 *  3. Si `status === 2` (paid), llamamos RPC para descontar stock y
 *     marcar la orden como `paid` (idempotente).
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
    const queryParams: Record<string, string> = {
      apiKey: FLOW_API_KEY,
      token,
    };
    queryParams.s = sign(queryParams, FLOW_SECRET_KEY);
    const qs = new URLSearchParams(queryParams).toString();

    const res = await fetch(`${FLOW_API_URL}/payment/getStatus?${qs}`, {
      method: "GET",
    });
    const data: unknown = await res.json().catch(() => ({}));
    const obj = (data ?? {}) as Record<string, unknown>;

    if (!res.ok) {
      console.error("[flow-webhook] getStatus respondió error", {
        status: res.status,
        body: obj,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const statusCode = Number(obj.status);
    const commerceOrder = String(obj.commerceOrder ?? "").trim();

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

    // Flow status:  1 → pendiente  2 → pagado  3 → rechazado  4 → cancelado

    if (statusCode === 1) {
      // Genuinamente pendiente: Flow puede volver a confirmar, no tocar la orden.
      console.log("[flow-webhook] pago pendiente (statusCode 1), sin cambios", { commerceOrder });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (statusCode === 3 || statusCode === 4) {
      // Terminal sin pago: marcar cancelled para que el polling de la confirmación lo detecte.
      // Guard .eq("status", "awaiting_payment") evita pisar una orden ya paid si este
      // webhook de rechazo llega tarde (después del webhook de pago exitoso).
      console.log("[flow-webhook] pago no completado, marcando cancelled", { commerceOrder, statusCode });
      await updateOrderIfStatus(orderRow.id, "awaiting_payment", { status: "cancelled" });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (statusCode !== 2) {
      console.warn("[flow-webhook] statusCode desconocido, sin cambios", { commerceOrder, statusCode });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // ── 3. Descontar stock (idempotente) ───────────────────────────────────
    const stockRes = await confirmPaidOrderAndDecrementStock(orderRow.id);
    if (!stockRes.ok) {
      console.error("[flow-webhook] error descontando stock", {
        commerceOrder,
        error: stockRes.error,
        code: stockRes.code,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    console.log("[flow-webhook] orden confirmada", {
      commerceOrder,
      alreadyDiscounted: stockRes.alreadyDiscounted,
      decrementedLines: stockRes.decrementedLines,
      finalStatus: stockRes.finalStatus,
    });

    // Emails admin + cliente, y Purchase de Meta CAPI — solo en el primer
    // webhook de pago (idempotente vía alreadyDiscounted).
    if (!stockRes.alreadyDiscounted) {
      let fullOrder: Awaited<ReturnType<typeof getOrderById>> = null;
      try {
        fullOrder = await getOrderById(orderRow.id);
      } catch (fetchError) {
        console.error("[flow-webhook] error leyendo la orden para notificaciones:", fetchError);
      }

      if (fullOrder) {
        try {
          const addr = (fullOrder.shipping_address ?? {}) as Record<string, string>;
          await sendOrderNotification({
            orderNumber: fullOrder.order_number,
            orderStatus: "paid",
            customerName: fullOrder.customer_name,
            customerEmail: fullOrder.customer_email,
            customerPhone: fullOrder.customer_phone ?? null,
            shippingAddress: {
              direccion: addr.direccion ?? "",
              ciudad: addr.ciudad ?? "",
              region: addr.region ?? "",
            },
            items: (Array.isArray(fullOrder.items) ? fullOrder.items : []) as unknown as Parameters<
              typeof sendOrderNotification
            >[0]["items"],
            subtotal: fullOrder.subtotal,
            shippingCost: fullOrder.shipping_cost,
            total: fullOrder.total,
          });
        } catch (emailError) {
          console.error("[flow-webhook] error enviando emails de confirmación:", emailError);
        }

        // Meta CAPI Purchase — fuente de verdad server-side, no depende de que
        // el cliente vuelva a la página de gracias. Un fallo acá nunca debe
        // romper el webhook (la orden ya quedó 'paid' y con stock descontado).
        try {
          const eventId: string | undefined = fullOrder.display_code ?? commerceOrder;
          if (eventId) {
            const orderItems = Array.isArray(fullOrder.items) ? fullOrder.items : [];
            await sendMetaCapiPurchase({
              eventId,
              orderId: eventId,
              contentIds: orderItems
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((i: any) => i?.product_id)
                .filter((id: unknown): id is string => Boolean(id)),
              // value lo calcula sendMetaCapiPurchase con sumProductsValue (sin envío).
              items: orderItems.map(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (i: any) => ({ price: Number(i?.price) || 0, quantity: Number(i?.quantity) || 0 })
              ),
              eventSourceUrl: `${getPublicSiteUrl()}/checkout/confirmacion?order=${fullOrder.order_number}&display=${encodeURIComponent(eventId)}`,
              customerEmail: fullOrder.customer_email,
              customerPhone: fullOrder.customer_phone ?? null,
              clientIpAddress: fullOrder.client_ip_address ?? null,
              clientUserAgent: fullOrder.client_user_agent ?? null,
            });
          }
        } catch (capiError) {
          console.error("[flow-webhook] error enviando Purchase a Meta CAPI:", capiError);
        }
      }
    }

    // Sólo invalidar caches cuando hubo descuento real (evita re-invalidar
    // ante webhooks duplicados que entran al early-return idempotente).
    if (!stockRes.alreadyDiscounted && stockRes.decrementedLines > 0) {
      revalidateAfterStockChange();
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("[flow-webhook] excepción", err);
    return NextResponse.json({ error: "Error en webhook" }, { status: 500 });
  }
}
