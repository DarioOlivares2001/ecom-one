import type { Metadata } from "next";
import { listOrdersForAdminExcludingAwaitingPayment } from "@/lib/db/repositories/orders";
import { PedidosClient } from "./PedidosClient";

export const metadata: Metadata = { title: "Pedidos — Admin" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getOrders() {
  try {
    const data = await listOrdersForAdminExcludingAwaitingPayment();

    if (process.env.NODE_ENV === "development" && Array.isArray(data) && data.length > 0) {
      const sample = data.slice(0, 5).map((o) => ({
        order_number: o.order_number,
        /** Columna mostrada en listado (PedidosClient → getOrderPersistedTotal → `total`). */
        total: o.total,
        subtotal: o.subtotal,
        shipping_cost: o.shipping_cost,
        sumLinesFromJson:
          Array.isArray(o.items) && o.items.length > 0
            ? (o.items as { price?: number; quantity?: number }[]).reduce(
                (acc, row) => acc + Math.round(Number(row.price) || 0) * Math.max(1, Math.floor(Number(row.quantity) || 1)),
                0
              )
            : null,
      }));
      console.log("[admin/pedidos] montos en fila (5 pedidos más recientes)", sample);
    }

    return { orders: data ?? [], error: null };
  } catch (err) {
    console.error("[admin/pedidos] Excepción consultando orders:", err);
    return {
      orders: [],
      error: "Error inesperado al cargar pedidos.",
    };
  }
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const { orders, error } = await getOrders();

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  const initialFilterParam = searchParams?.filter;
  const initialFilter = Array.isArray(initialFilterParam) ? initialFilterParam[0] : initialFilterParam;
  return <PedidosClient orders={orders} initialFilter={initialFilter} />;
}
