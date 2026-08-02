import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import type { Database, Json } from "@/lib/supabase/types";
import { upsertClienteFromOrder } from "@/lib/clientes/upsertClienteFromOrder";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderNotification } from "@/lib/email/sendOrderNotification";
import { getPublicSiteUrl } from "@/lib/site-url";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";
import { generateDisplayCode } from "@/lib/orders/generateDisplayCode";
import {
  recalculateCheckoutOrder,
  type RecalculatedOrderLine,
} from "@/lib/checkout/recalculateCheckoutOrder";
import { confirmPaidOrderAndDecrementStock } from "@/lib/orders/confirmPaidAndDecrementStock";
import { revalidateAfterStockChange } from "@/lib/orders/revalidateAfterStockChange";
import { sendMetaCapiPurchase } from "@/lib/pixel/capi";

const FLOW_API_URL = process.env.FLOW_API_URL ?? "https://sandbox.flow.cl/api";
const FLOW_API_KEY = process.env.FLOW_API_KEY ?? "";
const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY ?? "";
const FLOW_MOCK =
  process.env.FLOW_MOCK === "true" || FLOW_API_KEY.toLowerCase().includes("sandbox");

// ─── HMAC-SHA256 signing ──────────────────────────────────────────────────────

function sign(params: Record<string, string>, secret: string): string {
  const message = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

type CheckoutCustomer = {
  name?: string;
  email?: string;
  phone?: string | null;
  address?: string;
  city?: string;
  region?: string;
  referencia?: string;
};

/** IP real del navegador (primer salto de x-forwarded-for) y user-agent — para Meta CAPI. */
function extractClientNetworkInfo(request: NextRequest): {
  ip: string | null;
  userAgent: string | null;
} {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() || null : null;
  const userAgent = request.headers.get("user-agent");
  return { ip, userAgent: userAgent?.trim() || null };
}

function buildOrderInsertPayload(
  customer: CheckoutCustomer,
  items: RecalculatedOrderLine[],
  subtotal: number,
  shippingCost: number,
  total: number,
  status: "awaiting_payment" | "pending" | "paid",
  clientNetworkInfo: { ip: string | null; userAgent: string | null }
): Database["public"]["Tables"]["orders"]["Insert"] {
  const referencia =
    typeof customer.referencia === "string" ? customer.referencia.trim() : "";
  return {
    status,
    customer_name: String(customer.name ?? "").trim() || "Cliente",
    customer_email: String(customer.email ?? "").trim(),
    customer_phone: customer.phone ?? null,
    shipping_address: {
      direccion: customer.address ?? "",
      ciudad: customer.city ?? "",
      region: customer.region ?? "",
      ...(referencia ? { referencia } : {}),
    } as Json,
    items: items as unknown as Json,
    subtotal: Math.round(subtotal),
    shipping_cost: Math.round(shippingCost),
    total: Math.round(total),
    flow_token: null,
    flow_order: null,
    notes: null,
    client_ip_address: clientNetworkInfo.ip,
    client_user_agent: clientNetworkInfo.userAgent,
  };
}

function logClientVsServerTotals(params: {
  clientSubtotal?: unknown;
  clientShipping?: unknown;
  clientTotal?: unknown;
  serverSubtotal: number;
  serverShipping: number;
  serverTotal: number;
}) {
  const cs = Number(params.clientSubtotal);
  const cg = Number(params.clientShipping);
  const ct = Number(params.clientTotal);
  const { serverSubtotal, serverShipping, serverTotal } = params;
  if (Number.isFinite(cs) && cs !== serverSubtotal) {
    console.warn("[checkout-price] subtotal mismatch", {
      clientSubtotal: cs,
      serverSubtotal,
      delta: serverSubtotal - cs,
    });
  }
  if (Number.isFinite(cg) && cg !== serverShipping) {
    console.warn("[checkout-price] shipping mismatch", {
      clientShipping: cg,
      serverShipping,
      delta: serverShipping - cg,
    });
  }
  if (Number.isFinite(ct) && ct !== serverTotal) {
    console.warn("[checkout-price] total mismatch", {
      clientTotal: ct,
      serverTotal,
      delta: serverTotal - ct,
    });
  }
}

/** Log temporal tras insert: totales persistidos en `orders` e importes por línea (mismo payload que el insert). */
function logPersistedOrderAfterInsert(params: {
  order_number: number;
  subtotal: number;
  shipping_cost: number;
  total: number;
  items: RecalculatedOrderLine[];
}) {
  const lineTotals = params.items.map((it) => ({
    name: it.name,
    price: it.price,
    quantity: it.quantity,
    lineTotal: it.line_total,
    discount_source: it.discount_source,
  }));
  console.log("[flow-create-order-persisted]", {
    order_number: params.order_number,
    subtotal: params.subtotal,
    shipping_cost: params.shipping_cost,
    total: params.total,
    lineTotals,
  });
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      customer?: CheckoutCustomer;
      items?: unknown;
      subtotal?: unknown;
      shippingCost?: unknown;
      total?: unknown;
    };
    const { customer } = body;

    if (!customer?.email || typeof customer.email !== "string") {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const admin = createAdminClient();
    const settings = await getStoreSettings();
    const clientNetworkInfo = extractClientNetworkInfo(request);
    const priced = await recalculateCheckoutOrder(admin, body.items);
    if (!priced.ok) {
      return NextResponse.json({ error: priced.error }, { status: priced.status });
    }

    const { items, subtotal, shippingCost, total } = priced;

    if (process.env.NODE_ENV === "development") {
      console.log("[flow-create totals]", {
        clientSubtotal: body.subtotal,
        clientShipping: body.shippingCost,
        clientTotal: body.total,
        serverSubtotal: subtotal,
        serverShipping: shippingCost,
        serverTotal: total,
        lines: items.map((l) => ({
          product_id: l.product_id,
          variant_id: l.variant_id,
          name: l.name,
          quantity: l.quantity,
          unitPrice: l.price,
          lineTotal: l.line_total,
        })),
      });
    }

    logClientVsServerTotals({
      clientSubtotal: body.subtotal,
      clientShipping: body.shippingCost,
      clientTotal: body.total,
      serverSubtotal: subtotal,
      serverShipping: shippingCost,
      serverTotal: total,
    });

    const orderPayload = buildOrderInsertPayload(
      customer,
      items,
      subtotal,
      shippingCost,
      total,
      "awaiting_payment",
      clientNetworkInfo
    );

    // ── Mock mode ─────────────────────────────────────────────────────────────
    if (FLOW_MOCK) {
      const mockPayload = buildOrderInsertPayload(
        customer,
        items,
        subtotal,
        shippingCost,
        total,
        "paid",
        clientNetworkInfo
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (admin as any)
        .from("orders")
        .insert(mockPayload)
        .select("id, order_number")
        .single();

      if (error) {
        console.error("[Flow mock] Error creando orden:", error.message);
        return NextResponse.json({ error: "Error al crear la orden de prueba" }, { status: 500 });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orderNumber = (data as any).order_number as number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orderId = (data as any).id as string;

      // Descontar stock atómicamente (paid en mock = pago confirmado).
      const stockRes = await confirmPaidOrderAndDecrementStock(admin, orderId);
      if (!stockRes.ok) {
        console.error("[Flow mock][stock] error descontando stock", {
          orderNumber,
          orderId,
          error: stockRes.error,
          code: stockRes.code,
        });
      } else {
        console.log("[Flow mock][stock] descuento aplicado", {
          orderNumber,
          alreadyDiscounted: stockRes.alreadyDiscounted,
          decrementedLines: stockRes.decrementedLines,
          finalStatus: stockRes.finalStatus,
        });
        if (!stockRes.alreadyDiscounted && stockRes.decrementedLines > 0) {
          revalidateAfterStockChange();
        }
      }
      try {
        await upsertClienteFromOrder(
          admin,
          {
            name: customer.name ?? "",
            email: customer.email,
            phone: customer.phone ?? null,
            address: customer.address,
            city: customer.city,
            region: customer.region,
          },
          total
        );
      } catch (e) {
        console.error("[cliente-upsert] error", {
          phase: "mock_route",
          email: customer.email,
          error: String(e),
        });
      }
      const mockToken = `MOCK-${orderNumber}`;
      const displayCode = generateDisplayCode(orderNumber, settings.order_number_offset);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from("orders")
        .update({ display_code: displayCode })
        .eq("id", orderId);
      console.info(`[Flow mock] Orden #${orderNumber} (${displayCode}) creada con status 'paid'`);
      logPersistedOrderAfterInsert({
        order_number: orderNumber,
        subtotal: mockPayload.subtotal,
        shipping_cost: mockPayload.shipping_cost,
        total: mockPayload.total,
        items,
      });
      console.log("[order-created]", {
        mode: "mock",
        orderNumber,
        status: "paid",
        customerEmail: customer.email,
      });

      try {
        console.log("[email] trigger notificación mock (admin + cliente)");
        await sendOrderNotification({
          orderNumber,
          orderStatus: "paid",
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone ?? null,
          shippingAddress: {
            direccion: customer.address,
            ciudad: customer.city,
            region: customer.region,
          },
          items,
          subtotal,
          shippingCost,
          total,
        });
      } catch (emailError) {
        console.error("[email-error] Falló notificación de pedido:", emailError);
      }

      const siteUrl = getPublicSiteUrl();

      // Meta CAPI Purchase — mismo gate de idempotencia que el email (alreadyDiscounted).
      // Un fallo acá nunca debe romper la creación de la orden mock.
      if (stockRes.ok && !stockRes.alreadyDiscounted) {
        try {
          await sendMetaCapiPurchase({
            eventId: displayCode,
            orderId: displayCode,
            contentIds: items.map((i) => i.product_id),
            // value lo calcula sendMetaCapiPurchase con sumProductsValue (sin envío).
            items: items.map((i) => ({ price: i.price, quantity: i.quantity })),
            eventSourceUrl: `${siteUrl}/checkout/confirmacion?order=${orderNumber}&display=${encodeURIComponent(displayCode)}`,
            customerEmail: customer.email,
            customerPhone: customer.phone ?? null,
            clientIpAddress: clientNetworkInfo.ip,
            clientUserAgent: clientNetworkInfo.userAgent,
          });
        } catch (capiError) {
          console.error("[meta-capi-error] Falló Purchase (mock):", capiError);
        }
      }

      return NextResponse.json({
        redirectUrl: `${siteUrl}/checkout/confirmacion?order=${orderNumber}&display=${encodeURIComponent(displayCode)}&token=${mockToken}&mock=1`,
        token: mockToken,
        flowOrder: 0,
        commerceOrder: displayCode,
      });
    }

    // ── Live mode — insert pending order, then call Flow ──────────────────────

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: orderData, error: orderError } = await (admin as any)
      .from("orders")
      .insert(orderPayload)
      .select("order_number")
      .single();

    if (orderError || orderData == null) {
      console.error("[Flow create] Error creando orden pending:", orderError?.message);
      return NextResponse.json(
        { error: "No se pudo crear la orden antes de iniciar el pago." },
        { status: 500 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderNumberLive = (orderData as any).order_number as number;
    if (!Number.isFinite(orderNumberLive)) {
      return NextResponse.json(
        { error: "No se pudo crear la orden antes de iniciar el pago." },
        { status: 500 }
      );
    }

    logPersistedOrderAfterInsert({
      order_number: orderNumberLive,
      subtotal: orderPayload.subtotal,
      shipping_cost: orderPayload.shipping_cost,
      total: orderPayload.total,
      items,
    });

    try {
      await upsertClienteFromOrder(
        admin,
        {
          name: customer.name ?? "",
          email: customer.email,
          phone: customer.phone ?? null,
          address: customer.address,
          city: customer.city,
          region: customer.region,
        },
        total
      );
    } catch (e) {
      console.error("[cliente-upsert] error", {
        phase: "live_route",
        email: customer.email,
        error: String(e),
      });
    }

    const displayCodeLive = generateDisplayCode(orderNumberLive, settings.order_number_offset);
    const commerceOrder = displayCodeLive;
    console.log("[order-created]", {
      mode: "live",
      orderNumber: orderNumberLive,
      status: "pending",
      customerEmail: customer.email,
    });

    if (!FLOW_API_KEY || !FLOW_SECRET_KEY) {
      return NextResponse.json(
        {
          error:
            "Las credenciales de Flow no están configuradas. " +
            "Agrega FLOW_API_KEY y FLOW_SECRET_KEY en .env.local",
        },
        { status: 503 }
      );
    }

    const siteUrl = getPublicSiteUrl();
    const params: Record<string, string> = {
      apiKey: FLOW_API_KEY,
      subject: `${settings.store_name} — ${commerceOrder}`,
      currency: "CLP",
      amount: String(Math.round(total)),
      email: customer.email,
      urlConfirmation: `${siteUrl}/api/flow/webhook`,
      urlReturn: `${siteUrl}/checkout/confirmacion?order=${orderNumberLive}&display=${encodeURIComponent(displayCodeLive)}`,
      commerceOrder,
    };
    params.s = sign(params, FLOW_SECRET_KEY);

    const flowRes = await fetch(`${FLOW_API_URL}/payment/create`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });

    const flowData = await flowRes.json();

    if (!flowRes.ok || !flowData.url || !flowData.token) {
      console.error("Flow error:", flowData);
      return NextResponse.json(
        { error: flowData.message ?? "Error al crear la orden en Flow" },
        { status: 502 }
      );
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from("orders")
        .update({
          flow_token: flowData.token,
          flow_order: String(flowData.flowOrder),
          display_code: displayCodeLive,
        })
        .eq("order_number", orderNumberLive);
    } catch (e) {
      console.error("[flow-create] fallo UPDATE display_code/flow_token", {
        orderNumber: orderNumberLive,
        error: String(e),
      });
    }

    return NextResponse.json({
      redirectUrl: `${flowData.url}?token=${flowData.token}`,
      token: flowData.token,
      flowOrder: flowData.flowOrder,
      commerceOrder,
    });
  } catch (err) {
    console.error("Flow create route error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
