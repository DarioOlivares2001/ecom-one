import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";

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

export async function getOrderByOrderNumber(orderNumber: number): Promise<Order | null> {
  const rows = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
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

/** Pedidos visibles en el listado admin: excluye `awaiting_payment` (carritos abandonados/en pago). */
export async function listOrdersForAdminExcludingAwaitingPayment(): Promise<Order[]> {
  const rows = await db
    .select()
    .from(orders)
    .where(sql`${orders.status} <> 'awaiting_payment'`)
    .orderBy(desc(orders.createdAt));
  return rows.map(mapOrder);
}

const DASHBOARD_PAID_STATUSES = ["paid", "shipped", "delivered"] as const;

/** Datos crudos para /admin/dashboard (7 queries en paralelo, la agregación queda en la página). */
export async function getDashboardMetrics(params: {
  todayStart: Date;
  monthStart: Date;
  weekStart: Date;
}) {
  const [todayRows, monthRows, pendingCountRows, completedCountRows, recent, chartRows, allStatusRows] =
    await Promise.all([
      db
        .select({ total: orders.total })
        .from(orders)
        .where(
          and(inArray(orders.status, DASHBOARD_PAID_STATUSES), gte(orders.createdAt, params.todayStart))
        ),
      db
        .select({ total: orders.total })
        .from(orders)
        .where(
          and(inArray(orders.status, DASHBOARD_PAID_STATUSES), gte(orders.createdAt, params.monthStart))
        ),
      db.select({ value: count() }).from(orders).where(eq(orders.status, "pending")),
      db
        .select({ value: count() })
        .from(orders)
        .where(
          and(inArray(orders.status, DASHBOARD_PAID_STATUSES), gte(orders.createdAt, params.monthStart))
        ),
      db
        .select({
          orderNumber: orders.orderNumber,
          displayCode: orders.displayCode,
          customerName: orders.customerName,
          customerEmail: orders.customerEmail,
          total: orders.total,
          status: orders.status,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .orderBy(desc(orders.createdAt))
        .limit(5),
      db
        .select({ total: orders.total, createdAt: orders.createdAt })
        .from(orders)
        .where(
          and(inArray(orders.status, DASHBOARD_PAID_STATUSES), gte(orders.createdAt, params.weekStart))
        ),
      db.select({ status: orders.status }).from(orders),
    ]);

  return {
    todayRows,
    monthRows,
    pendingCount: pendingCountRows[0]?.value ?? 0,
    completedCount: completedCountRows[0]?.value ?? 0,
    recentOrders: recent.map((r) => ({
      order_number: r.orderNumber,
      display_code: r.displayCode,
      customer_name: r.customerName,
      customer_email: r.customerEmail,
      total: r.total,
      status: r.status,
      created_at: r.createdAt.toISOString(),
    })),
    chartRows: chartRows.map((r) => ({ total: r.total, created_at: r.createdAt.toISOString() })),
    allStatuses: allStatusRows.map((r) => r.status),
  };
}

/** Búsqueda pública por display_code + email de dueño (case-insensitive), para seguimiento de pedido. */
export async function getOrderByDisplayCodeAndEmail(
  displayCode: string,
  ownerEmail: string
): Promise<Order | null> {
  const rows = await db
    .select()
    .from(orders)
    .where(
      sql`${orders.displayCode} = ${displayCode} and lower(${orders.customerEmail}) = lower(${ownerEmail})`
    )
    .limit(1);
  return rows[0] ? mapOrder(rows[0]) : null;
}

/**
 * Cancela en bloque las órdenes `awaiting_payment` creadas antes de `cutoff`
 * (red de seguridad del cron de pedidos vencidos). Devuelve los order_number cancelados.
 */
export async function cancelStaleAwaitingPaymentOrders(cutoff: Date): Promise<number[]> {
  const rows = await db
    .update(orders)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(sql`${orders.status} = 'awaiting_payment' and ${orders.createdAt} < ${cutoff}`)
    .returning({ orderNumber: orders.orderNumber });
  return rows.map((r) => r.orderNumber);
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

function buildUpdateValues(input: OrderUpdateInput): Record<string, unknown> {
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
  return values;
}

export async function updateOrder(id: string, input: OrderUpdateInput): Promise<Order | null> {
  const values = buildUpdateValues(input);
  if (Object.keys(values).length === 0) return getOrderById(id);

  const [row] = await db
    .update(orders)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(orders.id, id))
    .returning();
  return row ? mapOrder(row) : null;
}

export async function updateOrderByOrderNumber(
  orderNumber: number,
  input: OrderUpdateInput
): Promise<Order | null> {
  const values = buildUpdateValues(input);
  if (Object.keys(values).length === 0) return getOrderByOrderNumber(orderNumber);

  const [row] = await db
    .update(orders)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(orders.orderNumber, orderNumber))
    .returning();
  return row ? mapOrder(row) : null;
}

/** Actualiza condicionalmente solo si la orden está actualmente en `expectedStatus` (guard anti-carrera). */
export async function updateOrderIfStatus(
  id: string,
  expectedStatus: Order["status"],
  input: OrderUpdateInput
): Promise<Order | null> {
  const values = buildUpdateValues(input);
  if (Object.keys(values).length === 0) return getOrderById(id);

  const [row] = await db
    .update(orders)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(orders.id, id), eq(orders.status, expectedStatus)))
    .returning();
  return row ? mapOrder(row) : null;
}
