import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrderById } from "@/lib/db/repositories/orders";
import { getProductsByIds } from "@/lib/db/repositories/products";
import { OrderDetail } from "./OrderDetail";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";

export const metadata: Metadata = { title: "Detalle de pedido — Admin" };

async function getOrder(id: string) {
  try {
    return await getOrderById(id);
  } catch {
    return null;
  }
}

/**
 * Enlace de Dropi *actual* de cada producto de la orden, por id — fallback
 * para pedidos creados antes de que el producto tuviera enlace (o cuyo
 * snapshot de línea no lo trae). Si el producto ya no existe, o no tiene
 * enlace, simplemente no aparece en el mapa y el botón no se muestra.
 */
async function getProductDropiUrlsForOrder(order: {
  items: unknown;
}): Promise<Record<string, string | null>> {
  const items = Array.isArray(order.items) ? order.items : [];
  const productIds = Array.from(
    new Set(
      items
        .map((item) => (item as { product_id?: unknown })?.product_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );
  if (productIds.length === 0) return {};

  try {
    const products = await getProductsByIds(productIds);
    const map: Record<string, string | null> = {};
    for (const p of products) {
      map[p.id] = p.dropi_product_url;
    }
    return map;
  } catch (error) {
    console.error("[admin/pedidos] error resolviendo enlaces de Dropi:", error);
    return {};
  }
}

export default async function PedidoDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [order, settings] = await Promise.all([getOrder(params.id), getStoreSettings()]);
  if (!order) notFound();
  const productDropiUrls = await getProductDropiUrlsForOrder(order);
  return (
    <OrderDetail
      order={order}
      storeName={settings.store_name}
      productDropiUrls={productDropiUrls}
    />
  );
}
