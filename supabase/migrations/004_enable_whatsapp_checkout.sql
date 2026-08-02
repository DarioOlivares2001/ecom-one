-- Opción de pedido por WhatsApp desde el carrito (store_settings).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'store_settings'
      AND column_name = 'enable_whatsapp_checkout'
  ) THEN
    ALTER TABLE store_settings
      ADD COLUMN enable_whatsapp_checkout BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;
