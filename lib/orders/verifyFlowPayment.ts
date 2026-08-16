import "server-only";

import type { Order } from "@/lib/db/types";
import { getOrderById, updateOrder, updateOrderIfStatus } from "@/lib/db/repositories/orders";
import { confirmPaidOrderAndDecrementStock } from "@/lib/orders/confirmPaidAndDecrementStock";
import { revalidateAfterStockChange } from "@/lib/orders/revalidateAfterStockChange";
import { upsertClienteFromOrder } from "@/lib/clientes/upsertClienteFromOrder";
import { sendOrderNotification } from "@/lib/email/sendOrderNotification";
import { sendMetaCapiPurchase } from "@/lib/pixel/capi";
import { getPublicSiteUrl } from "@/lib/site-url";
import { getFlowPaymentStatus } from "@/lib/flow/getPaymentStatus";

/**
 * Núcleo compartido de confirmación de pagos Flow. Tres entradas distintas
 * terminan acá:
 *  - el webhook (`app/api/flow/webhook`), que ya tiene el status de Flow recién consultado;
 *  - la verificación directa en el retorno del navegador (`app/api/orders/status`),
 *    necesaria porque Flow Sandbox no puede alcanzar un webhook en localhost;
 *  - `cancel-if-unpaid`, como red de seguridad al agotarse el polling.
 * Las tres llaman, directa o indirectamente, a `applyFlowStatusToOrder`, que
 * a su vez delega toda la atomicidad real en `confirm_paid_order_and_decrement_stock`
 * (lock de fila + `stock_discounted` como guard de idempotencia) — así que
 * dos confirmaciones casi simultáneas de la misma orden nunca duplican pago,
 * stock ni cliente.
 */

const isDev = process.env.NODE_ENV !== "production";

function maskToken(token: string | null | undefined): string {
  if (!token) return "(sin token)";
  if (token.length <= 8) return "****";
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

function devLog(message: string, data?: Record<string, unknown>) {
  if (!isDev) return;
  console.log(`[flow-confirm] ${message}`, data ?? {});
}

export interface FlowConfirmOutcome {
  /** Estado final de la orden tras aplicar (puede ser el mismo que tenía si no había nada que hacer). */
  status: Order["status"];
  /** `true` solo si ESTA llamada fue la que confirmó el pago por primera vez. */
  justConfirmedPaid: boolean;
  /** Flow reportó pagado pero la confirmación en Neon falló — evidencia en `orders.notes`, requiere revisión manual. */
  needsManualReview: boolean;
  technicalReason?: string;
}

function appendNote(existing: string | null, note: string): string {
  const stamp = new Date().toISOString();
  const line = `[${stamp}] ${note}`;
  return existing && existing.trim() ? `${existing.trim()}\n${line}` : line;
}

/**
 * Efectos de "primera confirmación": email de pedido pagado, Purchase de
 * Meta CAPI, upsert de cliente (acá — y solo acá — se cuenta el pedido:
 * nunca antes de confirmar el pago) y revalidación de caché. Se llama solo
 * cuando `!stockRes.alreadyDiscounted`, es decir la primera vez que una
 * orden se confirma — nunca en llamadas idempotentes repetidas.
 */
async function runFirstConfirmationSideEffects(
  orderId: string,
  decrementedLines: number
): Promise<void> {
  let fullOrder: Order | null = null;
  try {
    fullOrder = await getOrderById(orderId);
  } catch (fetchError) {
    console.error("[flow-confirm] error leyendo la orden para notificaciones:", fetchError);
  }

  if (fullOrder) {
    const addr = (fullOrder.shipping_address ?? {}) as Record<string, string>;

    try {
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
      console.error("[flow-confirm] error enviando emails de confirmación:", emailError);
    }

    try {
      const eventId = fullOrder.display_code ?? String(fullOrder.order_number);
      const orderItems = Array.isArray(fullOrder.items) ? fullOrder.items : [];
      await sendMetaCapiPurchase({
        eventId,
        orderId: eventId,
        contentIds: orderItems
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((i: any) => i?.product_id)
          .filter((id: unknown): id is string => Boolean(id)),
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
    } catch (capiError) {
      console.error("[flow-confirm] error enviando Purchase a Meta CAPI:", capiError);
    }

    try {
      await upsertClienteFromOrder(
        {
          name: fullOrder.customer_name,
          email: fullOrder.customer_email,
          phone: fullOrder.customer_phone ?? null,
          address: addr.direccion ?? null,
          city: addr.ciudad ?? null,
          region: addr.region ?? null,
        },
        fullOrder.total
      );
    } catch (clienteError) {
      console.error("[flow-confirm] error actualizando cliente:", clienteError);
    }
  }

  if (decrementedLines > 0) {
    revalidateAfterStockChange();
  }
}

/**
 * Dado un pedido y un status de Flow YA CONOCIDO (el caller ya lo consultó),
 * aplica la confirmación/cancelación idempotente. No vuelve a llamar a Flow.
 */
export async function applyFlowStatusToOrder(
  order: Order,
  flowStatusCode: number
): Promise<FlowConfirmOutcome> {
  if (order.status !== "awaiting_payment") {
    return { status: order.status, justConfirmedPaid: false, needsManualReview: false };
  }

  if (flowStatusCode === 1) {
    devLog("pago pendiente en Flow, sin cambios", { orderId: order.id });
    return { status: "awaiting_payment", justConfirmedPaid: false, needsManualReview: false };
  }

  if (flowStatusCode === 3 || flowStatusCode === 4) {
    const updated = await updateOrderIfStatus(order.id, "awaiting_payment", { status: "cancelled" });
    devLog("pago no completado en Flow, orden cancelada", { orderId: order.id, flowStatusCode });
    return { status: updated?.status ?? "cancelled", justConfirmedPaid: false, needsManualReview: false };
  }

  if (flowStatusCode !== 2) {
    devLog("status de Flow desconocido, sin cambios", { orderId: order.id, flowStatusCode });
    return { status: order.status, justConfirmedPaid: false, needsManualReview: false };
  }

  // flowStatusCode === 2 (pagado) — confirmar atómicamente.
  const stockRes = await confirmPaidOrderAndDecrementStock(order.id);

  if (!stockRes.ok) {
    console.error("[flow-confirm][CRITICAL] Flow confirmó el pago pero la confirmación en Neon falló", {
      orderId: order.id,
      reason: stockRes.error,
    });
    try {
      await updateOrder(order.id, {
        notes: appendNote(
          order.notes,
          `Flow confirmó el pago (status Flow=2) pero confirm_paid_order_and_decrement_stock falló: ${stockRes.error}. Revisar y reintentar manualmente.`
        ),
      });
    } catch (noteError) {
      console.error("[flow-confirm][CRITICAL] además falló al guardar la nota de evidencia:", noteError);
    }
    return {
      status: order.status,
      justConfirmedPaid: false,
      needsManualReview: true,
      technicalReason: stockRes.error,
    };
  }

  devLog("confirm_paid_order_and_decrement_stock OK", {
    orderId: order.id,
    alreadyDiscounted: stockRes.alreadyDiscounted,
    decrementedLines: stockRes.decrementedLines,
    finalStatus: stockRes.finalStatus,
  });

  if (stockRes.alreadyDiscounted) {
    // Otra llamada (webhook / verificación directa / cancel-if-unpaid) ya la había confirmado.
    return {
      status: stockRes.finalStatus as Order["status"],
      justConfirmedPaid: false,
      needsManualReview: false,
    };
  }

  await runFirstConfirmationSideEffects(order.id, stockRes.decrementedLines);
  return {
    status: stockRes.finalStatus as Order["status"],
    justConfirmedPaid: true,
    needsManualReview: false,
  };
}

/**
 * Para cuando el caller no tiene ya un status de Flow fresco: consulta a
 * Flow con el `flow_token` persistido y delega en `applyFlowStatusToOrder`.
 * No hace nada si la orden no está `awaiting_payment`, no tiene
 * `flow_token`, o el token es de una orden mock (`MOCK-...`, que ya nace `paid`).
 */
export async function verifyFlowPaymentForOrder(order: Order): Promise<FlowConfirmOutcome> {
  if (order.status !== "awaiting_payment") {
    return { status: order.status, justConfirmedPaid: false, needsManualReview: false };
  }

  const token = order.flow_token?.trim();
  if (!token || token.startsWith("MOCK-")) {
    return { status: order.status, justConfirmedPaid: false, needsManualReview: false };
  }

  devLog("verificando pago directamente con Flow", { orderId: order.id, token: maskToken(token) });

  let flowRes;
  try {
    flowRes = await getFlowPaymentStatus(token);
  } catch (err) {
    console.error("[flow-confirm] error de red consultando a Flow:", err);
    return { status: order.status, justConfirmedPaid: false, needsManualReview: false };
  }

  if (!flowRes.ok) {
    devLog("Flow respondió error HTTP al consultar status", {
      orderId: order.id,
      httpStatus: flowRes.httpStatus,
    });
    return { status: order.status, justConfirmedPaid: false, needsManualReview: false };
  }

  return applyFlowStatusToOrder(order, flowRes.statusCode);
}
