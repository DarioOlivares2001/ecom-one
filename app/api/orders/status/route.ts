import { NextRequest, NextResponse } from "next/server";
import { getOrderByOrderNumber } from "@/lib/db/repositories/orders";

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

    // display_code/items solo se usan para el Purchase del navegador
    // (deduplicado por event_id con el Purchase de servidor; el value lo
    // calcula pixelEvents.purchase con sumProductsValue a partir de items);
    // no se exponen salvo cuando la orden ya está pagada. Se manda solo el
    // subconjunto de campos que el cliente realmente usa (product_id, price,
    // quantity) — nunca el objeto crudo de la línea, que puede traer campos
    // de uso interno del admin (ej. dropi_product_url) que no deben llegar
    // al navegador del cliente.
    const isPaid = data.status === "paid";
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
      status: data.status as string,
      ...(isPaid
        ? {
            displayCode: data.display_code ?? null,
            items: safeItems,
          }
        : {}),
    });
  } catch (err) {
    console.error("[orders/status] excepción:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
