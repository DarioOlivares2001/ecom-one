-- 002_update_orders_status_check.sql
-- Actualiza el CHECK de orders.status para soportar el flujo oficial

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (
    status IN (
      'pending',
      'paid',
      'preparing',
      'shipped',
      'delivered',
      'cancelled'
    )
  );
