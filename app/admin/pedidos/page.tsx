import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { PedidosClient } from "./PedidosClient";

export const metadata: Metadata = { title: "Pedidos — Admin" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getOrders() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (createAdminClient() as any)
      .from("orders")
      .select(
        "id, order_number, display_code, customer_name, customer_email, items, subtotal, shipping_cost, total, status, created_at"
      )
      .neq("status", "awaiting_payment")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin/pedidos] Error consultando orders:", error.message);
      return {
        orders: [],
        error: "No se pudieron cargar los pedidos desde Supabase.",
      };
    }

    if (process.env.NODE_ENV === "development" && Array.isArray(data) && data.length > 0) {
      const sample = data.slice(0, 5).map((o: Record<string, unknown>) => ({
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
