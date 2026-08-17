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
 * Datos *actuales* de cada producto de la orden, por id — fallback para
 * pedidos cuyo snapshot de línea no trae el dato (enlace de Dropi que no
 * existía aún al pedir, o imagen de pedidos creados antes del snapshot de
 * imagen). Si el producto ya no existe, simplemente no aparece en el mapa.
 */
async function getProductLookupsForOrder(order: {
  items: unknown;
}): Promise<{
  dropiUrls: Record<string, string | null>;
  images: Record<string, string | null>;
}> {
  const items = Array.isArray(order.items) ? order.items : [];
  const productIds = Array.from(
    new Set(
      items
        .map((item) => (item as { product_id?: unknown })?.product_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );
  if (productIds.length === 0) return { dropiUrls: {}, images: {} };

  try {
    const products = await getProductsByIds(productIds);
    const dropiUrls: Record<string, string | null> = {};
    const images: Record<string, string | null> = {};
    for (const p of products) {
      dropiUrls[p.id] = p.dropi_product_url;
      images[p.id] = Array.isArray(p.images) && p.images[0] ? p.images[0] : null;
    }
    return { dropiUrls, images };
  } catch (error) {
    console.error("[admin/pedidos] error resolviendo datos de producto para el detalle:", error);
    return { dropiUrls: {}, images: {} };
  }
}

export default async function PedidoDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [order, settings] = await Promise.all([getOrder(params.id), getStoreSettings()]);
  if (!order) notFound();
  const { dropiUrls: productDropiUrls, images: productImages } = await getProductLookupsForOrder(order);
  return (
    <OrderDetail
      order={order}
      storeName={settings.store_name}
      productDropiUrls={productDropiUrls}
      productImages={productImages}
    />
  );
}
