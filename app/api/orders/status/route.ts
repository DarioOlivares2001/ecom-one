import { NextRequest, NextResponse } from "next/server";
import { getOrderByOrderNumber } from "@/lib/db/repositories/orders";
import { verifyFlowPaymentForOrder } from "@/lib/orders/verifyFlowPayment";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const orderNum = Number(request.nextUrl.searchParams.get("order"));
  if (!Number.isFinite(orderNum) || orderNum <= 0) {
    return NextResponse.json({ error: "Parámetro order requerido" }, { status: 400 });
  }

  try {
    const data = await getOrderByOrderNumber(orderNum);

    if (!data) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }

    // Verificación directa con Flow en servidor: el navegador SÍ puede llegar
    // a esta ruta (es el propio cliente quien la llama al pollear la página
    // de confirmación), a diferencia del webhook de Flow, que en local no
    // puede alcanzar `localhost`. Si la orden sigue `awaiting_payment` y tiene
    // `flow_token`, consultamos a Flow acá mismo antes de responder — así el
    // pago se confirma igual aunque el webhook nunca llegue.
    let effectiveStatus = data.status;
    let needsManualReview = false;
    if (data.status === "awaiting_payment") {
      const outcome = await verifyFlowPaymentForOrder(data);
      effectiveStatus = outcome.status;
      needsManualReview = outcome.needsManualReview;
    }

    const isPaid = effectiveStatus === "paid";
    const rawItems = Array.isArray(data.items) ? data.items : [];
    const safeItems = rawItems.map((item) => {
      const i = (item ?? {}) as Record<string, unknown>;
      return {
        product_id: typeof i.product_id === "string" ? i.product_id : undefined,
        price: typeof i.price === "number" ? i.price : Number(i.price) || 0,
        quantity: typeof i.quantity === "number" ? i.quantity : Number(i.quantity) || 0,
      };
    });
    return NextResponse.json({
      status: effectiveStatus as string,
      ...(needsManualReview ? { needsManualReview: true } : {}),
      ...(isPaid ? { displayCode: data.display_code ?? null, items: safeItems } : {}),
    });
  } catch (err) {
    console.error("[orders/status] excepción:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
