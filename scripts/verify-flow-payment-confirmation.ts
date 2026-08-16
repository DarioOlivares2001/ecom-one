/**
 * Prueba de integración contra el Neon real de este proyecto (ecom-one) para
 * el núcleo de confirmación de pagos Flow (`lib/orders/verifyFlowPayment.ts`)
 * arreglado en `fix: make Flow payment confirmation resilient after Neon migration`.
 *
 * Crea únicamente datos propios con prefijo `_test-flow-confirm-<timestamp>`
 * (producto, órdenes, cliente) y los borra al final sin importar el
 * resultado — nunca toca una fila que no haya creado este mismo script.
 *
 * Los módulos reales (`lib/orders/verifyFlowPayment.ts` y dependencias) usan
 * `import "server-only"`, que solo se resuelve corriendo dentro del runtime
 * de servidor de Next.js — por eso este script INSERTA/LEE/BORRA con SQL
 * crudo (igual que scripts/verify-migration-0001.mjs) pero invoca la lógica
 * real de confirmación a través de una ruta temporal
 * (app/api/test-flow-confirm-tmp) servida por el `next dev` ya corriendo en
 * localhost:3000 — así se prueba el código real, no una reimplementación.
 *
 * Requiere: `npm run dev` corriendo en localhost:3000 y
 * app/api/test-flow-confirm-tmp/route.ts presente (temporal, se borra aparte).
 *
 * Uso: npx tsx scripts/verify-flow-payment-confirmation.ts
 */
import dotenv from "dotenv";
import { Pool } from "@neondatabase/serverless";

dotenv.config({ path: ".env.local" });
dotenv.config();

const RUN_ID = String(Date.now());
const TEST_EMAIL = `_test-flow-confirm-${RUN_ID}@example.com`;
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

let failures = 0;

function assert(condition: unknown, message: string): void {
  if (condition) {
    console.log(`  OK: ${message}`);
  } else {
    failures += 1;
    console.error(`  FALLO: ${message}`);
  }
}

async function callConfirm(body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/test-flow-confirm-tmp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `Respuesta no-JSON de /api/test-flow-confirm-tmp (status ${res.status}): ${text.slice(0, 300)}`
    );
  }
  if (!res.ok) {
    throw new Error(`/api/test-flow-confirm-tmp devolvió ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("Falta DATABASE_URL en .env.local (conexión a Neon).");
  }

  // Ping rápido: confirma que el servidor de dev y la ruta temporal están arriba
  // ANTES de crear ningún dato de prueba (evita dejar basura si no hay servidor).
  try {
    const pingRes = await fetch(`${BASE_URL}/api/test-flow-confirm-tmp`, { method: "GET" });
    // GET no está implementado a propósito (solo POST) — cualquier respuesta HTTP
    // (incluso 405) confirma que el servidor y la ruta existen.
    void pingRes;
  } catch {
    throw new Error(
      `No se pudo conectar a ${BASE_URL}. Este script requiere "npm run dev" corriendo y ` +
        "app/api/test-flow-confirm-tmp/route.ts presente (ruta temporal de prueba)."
    );
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  const createdOrderIds: string[] = [];
  const createdProductIds: string[] = [];
  let clienteId: string | null = null;

  try {
    // ── Setup: producto de prueba con stock conocido ──────────────────────
    const {
      rows: [product],
    } = await client.query(
      `INSERT INTO products (slug, name, price, stock)
       VALUES ($1, '__TEST FLOW CONFIRM PRODUCT__', 10000, 10)
       RETURNING id, stock`,
      [`_test-flow-confirm-${RUN_ID}`]
    );
    createdProductIds.push(product.id);

    const createTestOrder = async (suffix: string, quantity: number, productId: string) => {
      const total = 10000 * quantity;
      const items = JSON.stringify([
        { product_id: productId, name: "__TEST FLOW CONFIRM PRODUCT__", price: 10000, quantity, image: "" },
      ]);
      const {
        rows: [order],
      } = await client.query(
        `INSERT INTO orders (status, customer_name, customer_email, shipping_address, items, subtotal, total, flow_token)
         VALUES ('awaiting_payment', '__TEST__', $1, '{"direccion":"Test 123","ciudad":"Santiago","region":"RM"}'::jsonb, $2::jsonb, $3, $3, $4)
         RETURNING id, order_number, status`,
        [TEST_EMAIL, items, total, `TEST-FLOW-CONFIRM-${RUN_ID}-${suffix}`]
      );
      createdOrderIds.push(order.id);
      return order as { id: string; order_number: number; status: string };
    };

    const getProductStock = async (productId: string): Promise<number> => {
      const {
        rows: [row],
      } = await client.query(`SELECT stock FROM products WHERE id = $1`, [productId]);
      return row.stock;
    };

    const getCliente = async (): Promise<{ id: string; total_orders: number; total_spent: string } | null> => {
      const { rows } = await client.query(
        `SELECT id, total_orders, total_spent FROM clientes WHERE lower(trim(email)) = lower(trim($1))`,
        [TEST_EMAIL]
      );
      return rows[0] ?? null;
    };

    const getOrderRow = async (
      orderId: string
    ): Promise<{ status: string; notes: string | null; stock_discounted: boolean }> => {
      const {
        rows: [row],
      } = await client.query(`SELECT status, notes, stock_discounted FROM orders WHERE id = $1`, [orderId]);
      return row;
    };

    // ── 1. Retorno exitoso: Flow dice pagado (status 2) ────────────────────
    console.log("\n[1] Retorno exitoso (Flow status=2)");
    const orderA = await createTestOrder("A", 2, product.id);

    const outcomeA1 = await callConfirm({ fn: "applyFlowStatusToOrder", orderId: orderA.id, flowStatusCode: 2 });
    assert(outcomeA1.status === "paid", `orden pasa a paid (obtuvo: ${outcomeA1.status})`);
    assert(outcomeA1.justConfirmedPaid === true, "primera confirmación marca justConfirmedPaid=true");
    assert(outcomeA1.needsManualReview === false, "sin needsManualReview");

    assert((await getProductStock(product.id)) === 8, "stock descontado una vez (10-2=8)");

    const clienteAfterFirst = await getCliente();
    assert(clienteAfterFirst?.total_orders === 1, `cliente creado con total_orders=1 (obtuvo: ${clienteAfterFirst?.total_orders})`);
    assert(Number(clienteAfterFirst?.total_spent) === 20000, `total_spent = total de la orden (obtuvo: ${clienteAfterFirst?.total_spent})`);
    clienteId = clienteAfterFirst?.id ?? null;

    // ── 2. Confirmación duplicada: misma orden (aún "awaiting_payment" desde
    //     el punto de vista del caller) confirmada una segunda vez → idempotente.
    console.log("\n[2] Confirmación duplicada (webhook + verificación directa casi simultáneos)");
    const outcomeA2 = await callConfirm({
      fn: "applyFlowStatusToOrder",
      orderId: orderA.id,
      flowStatusCode: 2,
      overrides: { status: "awaiting_payment" }, // simula el caller con el estado stale previo a la 1ra confirmación
    });
    assert(outcomeA2.status === "paid", "segunda confirmación sigue devolviendo paid");
    assert(outcomeA2.justConfirmedPaid === false, "segunda confirmación NO repite side-effects (justConfirmedPaid=false)");

    assert((await getProductStock(product.id)) === 8, "stock NO se descuenta una segunda vez (sigue en 8)");

    const clienteAfterSecond = await getCliente();
    assert(clienteAfterSecond?.total_orders === 1, `cliente NO duplica pedido (sigue en 1, obtuvo: ${clienteAfterSecond?.total_orders})`);

    // ── 3. Retorno sin webhook: solo verificación directa (mismo camino atómico) ─
    console.log("\n[3] Retorno sin webhook (solo verificación directa del navegador)");
    const orderB = await createTestOrder("B", 1, product.id);
    const outcomeB = await callConfirm({ fn: "applyFlowStatusToOrder", orderId: orderB.id, flowStatusCode: 2 });
    assert(outcomeB.status === "paid", "orden confirmada por el mismo camino que usaría la verificación directa");
    assert(outcomeB.justConfirmedPaid === true, "primera confirmación de esta orden");

    // verifyFlowPaymentForOrder: probar sus guards SIN llamar a la red real de
    // Flow (eso requeriría un flow_token válido de una transacción real de
    // Flow Sandbox, algo que este script no puede fabricar — ver nota final).
    console.log("\n[3b] Guards de verifyFlowPaymentForOrder (sin llamar a la red de Flow)");
    const alreadyPaidOutcome = await callConfirm({
      fn: "verifyFlowPaymentForOrder",
      orderId: orderB.id,
      overrides: { status: "paid" },
    });
    assert(
      alreadyPaidOutcome.status === "paid" && alreadyPaidOutcome.justConfirmedPaid === false,
      "orden ya paid: no-op, no intenta llamar a Flow"
    );

    const noTokenOutcome = await callConfirm({
      fn: "verifyFlowPaymentForOrder",
      orderId: orderB.id,
      overrides: { status: "awaiting_payment", flow_token: null },
    });
    assert(
      noTokenOutcome.status === "awaiting_payment" && !noTokenOutcome.needsManualReview,
      "sin flow_token: no-op, no intenta llamar a Flow"
    );

    const mockTokenOutcome = await callConfirm({
      fn: "verifyFlowPaymentForOrder",
      orderId: orderB.id,
      overrides: { status: "awaiting_payment", flow_token: "MOCK-1234" },
    });
    assert(mockTokenOutcome.status === "awaiting_payment", "flow_token MOCK-: no-op, no intenta llamar a Flow");

    // ── 4. Pago rechazado/cancelado en Flow (status 3) ──────────────────────
    console.log("\n[4] Pago rechazado en Flow (status=3)");
    const orderC = await createTestOrder("C", 1, product.id);
    const outcomeC = await callConfirm({ fn: "applyFlowStatusToOrder", orderId: orderC.id, flowStatusCode: 3 });
    assert(outcomeC.status === "cancelled", `orden pasa a cancelled (obtuvo: ${outcomeC.status})`);

    assert((await getProductStock(product.id)) === 7, "stock no se toca en un rechazo (10-2-1=7)");

    // ── 5. Flow dice pagado pero Neon falla al confirmar (stock insuficiente
    //     fuerza la excepción dentro de confirm_paid_order_and_decrement_stock) ─
    console.log("\n[5] Flow confirma pero Neon falla al confirmar (needsManualReview)");
    const {
      rows: [lowStockProduct],
    } = await client.query(
      `INSERT INTO products (slug, name, price, stock)
       VALUES ($1, '__TEST FLOW CONFIRM LOW STOCK__', 5000, 0)
       RETURNING id`,
      [`_test-flow-confirm-lowstock-${RUN_ID}`]
    );
    createdProductIds.push(lowStockProduct.id);

    const orderD = await createTestOrder("D", 1, lowStockProduct.id);
    const outcomeD = await callConfirm({ fn: "applyFlowStatusToOrder", orderId: orderD.id, flowStatusCode: 2 });
    assert(outcomeD.needsManualReview === true, "needsManualReview=true cuando Neon falla al confirmar");
    assert(outcomeD.status === "awaiting_payment", "orden NO queda marcada paid engañosamente al fallar la confirmación");

    const orderDRow = await getOrderRow(orderD.id);
    assert(
      Boolean(orderDRow.notes && orderDRow.notes.includes("Flow confirmó el pago")),
      "evidencia del fallo queda guardada en orders.notes para revisión manual"
    );
    assert(orderDRow.stock_discounted === false, "stock_discounted sigue false tras el fallo (no queda a medias)");

    console.log(
      "\nNO probado por este script (requiere URL pública alcanzable por Flow): la entrega HTTP real " +
        "del webhook desde los servidores de Flow (urlConfirmation), y una llamada real a payment/getStatus " +
        "con un flow_token válido emitido por una transacción real de Flow Sandbox — verifyFlowPaymentForOrder " +
        "se probó solo en sus guards (orden no awaiting_payment, sin token, token MOCK-), no en la llamada de red real."
    );
  } finally {
    // ── Limpieza: solo las filas creadas por este script ────────────────────
    console.log("\nLimpiando datos de prueba...");
    if (createdOrderIds.length > 0) {
      await client.query(`DELETE FROM orders WHERE id = ANY($1::uuid[])`, [createdOrderIds]);
    }
    if (clienteId) {
      await client.query(`DELETE FROM clientes WHERE id = $1`, [clienteId]);
    }
    if (createdProductIds.length > 0) {
      await client.query(`DELETE FROM products WHERE id = ANY($1::uuid[])`, [createdProductIds]);
    }
    console.log(
      `Limpieza completa: ${createdOrderIds.length} orden(es), ${clienteId ? 1 : 0} cliente, ${createdProductIds.length} producto(s) de prueba eliminados.`
    );
    client.release();
    await pool.end();
  }
}

main()
  .then(() => {
    if (failures > 0) {
      console.error(`\n${failures} aserción(es) fallaron.`);
      process.exitCode = 1;
    } else {
      console.log("\nTodas las aserciones pasaron.");
      process.exitCode = 0;
    }
  })
  .catch((error: unknown) => {
    console.error(
      "\n[verify-flow-payment-confirmation] Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
