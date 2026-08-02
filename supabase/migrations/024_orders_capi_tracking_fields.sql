-- 024_orders_capi_tracking_fields.sql
-- IP y user-agent del cliente, capturados en /api/flow/create (única request
-- del navegador en todo el flujo de pago) para mejorar el match de Meta
-- Conversions API cuando el Purchase se envía async desde el webhook de Flow.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'client_ip_address'
  ) THEN
    ALTER TABLE orders ADD COLUMN client_ip_address TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'client_user_agent'
  ) THEN
    ALTER TABLE orders ADD COLUMN client_user_agent TEXT;
  END IF;
END $$;
