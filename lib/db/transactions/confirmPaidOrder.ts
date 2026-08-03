import "server-only";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db/client";

export interface ConfirmPaidOrderResult {
  order_id: string;
  already_discounted: boolean;
  decremented_lines: number;
  final_status: string;
  [key: string]: unknown;
}

/**
 * Invoca la función nativa `confirm_paid_order_and_decrement_stock` (Postgres,
 * ver drizzle/0001_add_core_ecommerce_tables.sql). Toda la atomicidad —lock de
 * fila, descuento de stock por producto/variante, idempotencia vía
 * stock_discounted, transición de estado— ocurre dentro de la función en un
 * único statement; no se reimplementa esa lógica en JS a propósito (ver
 * MIGRATION_STATUS.md, decisión de Fase 2, sobre el driver neon-http).
 */
export async function confirmPaidOrderAndDecrementStock(
  orderId: string
): Promise<ConfirmPaidOrderResult> {
  const result = await db.execute<ConfirmPaidOrderResult>(
    sql`select * from confirm_paid_order_and_decrement_stock(${orderId}::uuid)`
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error(
      `confirm_paid_order_and_decrement_stock no devolvió resultado para la orden ${orderId}`
    );
  }
  return row;
}
