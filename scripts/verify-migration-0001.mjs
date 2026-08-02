import { Pool } from "@neondatabase/serverless";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query("BEGIN");

  const { rows: [product] } = await client.query(
    `INSERT INTO products (slug, name, price, stock)
     VALUES ('__migration_test__', '__MIGRATION TEST PRODUCT__', 1000, 5)
     RETURNING id, stock`
  );
  console.log("producto temporal creado, stock inicial:", product.stock);

  const items = JSON.stringify([
    { product_id: product.id, name: "test", price: 1000, quantity: 2, image: "" },
  ]);

  const { rows: [order] } = await client.query(
    `INSERT INTO orders (status, customer_name, customer_email, shipping_address, items, subtotal, total)
     VALUES ('pending', '__TEST__', 'test@example.com', '{}'::jsonb, $1::jsonb, 2000, 2000)
     RETURNING id, status`,
    [items]
  );
  console.log("orden temporal creada, status inicial:", order.status);

  const { rows: [result1] } = await client.query(
    `SELECT * FROM confirm_paid_order_and_decrement_stock($1)`,
    [order.id]
  );
  console.log("1ra llamada:", result1);

  const { rows: [result2] } = await client.query(
    `SELECT * FROM confirm_paid_order_and_decrement_stock($1)`,
    [order.id]
  );
  console.log("2da llamada (debe ser idempotente, already_discounted=true):", result2);

  const { rows: [productAfter] } = await client.query(
    `SELECT stock FROM products WHERE id = $1`,
    [product.id]
  );
  console.log("stock final (debe ser 3 = 5 - 2):", productAfter.stock);

  const { rows: [orderAfter] } = await client.query(
    `SELECT status, stock_discounted FROM orders WHERE id = $1`,
    [order.id]
  );
  console.log("orden final (debe ser status=paid, stock_discounted=true):", orderAfter);

  await client.query("ROLLBACK");
  console.log("\nROLLBACK ejecutado: ninguno de estos datos temporales quedó en la base.");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("ERROR, se hizo ROLLBACK:", err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
