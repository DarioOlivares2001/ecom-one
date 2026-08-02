-- ============================================================
-- 027_orders_status_check_awaiting_payment.sql
-- Alinea el CHECK de orders.status con 'awaiting_payment', valor que el
-- código escribe activamente (estado inicial de toda orden en modo no-mock:
-- app/api/flow/create/route.ts, webhook, cron cancel-stale-orders,
-- api/orders/cancel-if-unpaid) pero que la migración 002 nunca agregó al
-- CHECK. En producción este valor ya está permitido (el CHECK fue editado
-- fuera de una migración); este archivo lo deja versionado. No-op si el
-- CHECK ya lo permite.
-- ============================================================

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'awaiting_payment', 'pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled'
  ));
