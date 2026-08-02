import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import type { Order } from "@/lib/db/types";

type OrderRow = typeof orders.$inferSelect;

export function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    order_number: row.orderNumber,
    status: row.status as Order["status"],
    customer_name: row.customerName,
    customer_email: row.customerEmail,
    customer_phone: row.customerPhone,
    shipping_address: row.shippingAddress as Order["shipping_address"],
    items: row.items as Order["items"],
    subtotal: row.subtotal,
    shipping_cost: row.shippingCost,
    total: row.total,
    flow_token: row.flowToken,
    flow_order: row.flowOrder,
    display_code: row.displayCode,
    notes: row.notes,
    stock_discounted: row.stockDiscounted,
    client_ip_address: row.clientIpAddress,
    client_user_agent: row.clientUserAgent,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function getOrderById(id: string): Promise<Order | null> {
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return rows[0] ? mapOrder(rows[0]) : null;
}

export async function getOrderByFlowToken(flowToken: string): Promise<Order | null> {
  const rows = await db.select().from(orders).where(eq(orders.flowToken, flowToken)).limit(1);
  return rows[0] ? mapOrder(rows[0]) : null;
}

export async function getOrderByDisplayCode(displayCode: string): Promise<Order | null> {
  const rows = await db.select().from(orders).where(eq(orders.displayCode, displayCode)).limit(1);
  return rows[0] ? mapOrder(rows[0]) : null;
}

export async function listOrdersByEmail(email: string): Promise<Order[]> {
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.customerEmail, email))
    .orderBy(desc(orders.createdAt));
  return rows.map(mapOrder);
}

export async function listOrdersForAdmin(): Promise<Order[]> {
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
  return rows.map(mapOrder);
}

export interface OrderInsertInput {
  status?: Order["status"];
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
  shipping_address: unknown;
  items?: unknown;
  subtotal: number;
  shipping_cost?: number;
  total: number;
  flow_token?: string | null;
  flow_order?: string | null;
  display_code?: string | null;
  notes?: string | null;
  client_ip_address?: string | null;
  client_user_agent?: string | null;
}

export type OrderUpdateInput = Partial<OrderInsertInput> & {
  stock_discounted?: boolean;
};

export async function createOrder(input: OrderInsertInput): Promise<Order> {
  const [row] = await db
    .insert(orders)
    .values({
      status: input.status ?? "pending",
      customerName: input.customer_name,
      customerEmail: input.customer_email,
      customerPhone: input.customer_phone ?? null,
      shippingAddress: input.shipping_address,
      items: input.items ?? [],
      subtotal: input.subtotal,
      shippingCost: input.shipping_cost ?? 0,
      total: input.total,
      flowToken: input.flow_token ?? null,
      flowOrder: input.flow_order ?? null,
      displayCode: input.display_code ?? null,
      notes: input.notes ?? null,
      clientIpAddress: input.client_ip_address ?? null,
      clientUserAgent: input.client_user_agent ?? null,
    })
    .returning();
  return mapOrder(row);
}

export async function updateOrder(id: string, input: OrderUpdateInput): Promise<Order | null> {
  const values: Record<string, unknown> = {};
  if (input.status !== undefined) values.status = input.status;
  if (input.customer_name !== undefined) values.customerName = input.customer_name;
  if (input.customer_email !== undefined) values.customerEmail = input.customer_email;
  if (input.customer_phone !== undefined) values.customerPhone = input.customer_phone;
  if (input.shipping_address !== undefined) values.shippingAddress = input.shipping_address;
  if (input.items !== undefined) values.items = input.items;
  if (input.subtotal !== undefined) values.subtotal = input.subtotal;
  if (input.shipping_cost !== undefined) values.shippingCost = input.shipping_cost;
  if (input.total !== undefined) values.total = input.total;
  if (input.flow_token !== undefined) values.flowToken = input.flow_token;
  if (input.flow_order !== undefined) values.flowOrder = input.flow_order;
  if (input.display_code !== undefined) values.displayCode = input.display_code;
  if (input.notes !== undefined) values.notes = input.notes;
  if (input.client_ip_address !== undefined) values.clientIpAddress = input.client_ip_address;
  if (input.client_user_agent !== undefined) values.clientUserAgent = input.client_user_agent;
  if (input.stock_discounted !== undefined) values.stockDiscounted = input.stock_discounted;

  if (Object.keys(values).length === 0) return getOrderById(id);

  const [row] = await db
    .update(orders)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(orders.id, id))
    .returning();
  return row ? mapOrder(row) : null;
}
