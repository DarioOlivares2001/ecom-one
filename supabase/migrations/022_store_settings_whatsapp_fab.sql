-- 022_store_settings_whatsapp_fab.sql
-- Botón flotante de WhatsApp (contacto general) en toda la tienda pública,
-- independiente de enable_whatsapp_checkout (que es solo para cerrar pedido
-- por chat desde el carrito). Activado por defecto.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'enable_whatsapp_fab'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN enable_whatsapp_fab BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;
