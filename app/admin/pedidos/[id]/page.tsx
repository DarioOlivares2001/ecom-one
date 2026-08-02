import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrderById } from "@/lib/db/repositories/orders";
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

export default async function PedidoDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [order, settings] = await Promise.all([getOrder(params.id), getStoreSettings()]);
  if (!order) notFound();
  return <OrderDetail order={order} storeName={settings.store_name} />;
}
