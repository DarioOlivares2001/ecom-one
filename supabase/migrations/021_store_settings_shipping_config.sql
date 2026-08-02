-- 021_store_settings_shipping_config.sql
-- Costo de envío y umbral de envío gratis configurables desde /admin/configuracion.
-- Antes eran constantes hardcodeadas en lib/checkout/shipping.ts; los defaults
-- de abajo son exactamente esos mismos valores, para no cambiar el comportamiento
-- de tiendas existentes hasta que el admin los edite.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'shipping_cost_clp'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN shipping_cost_clp INTEGER NOT NULL DEFAULT 3990;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'shipping_free_threshold_clp'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN shipping_free_threshold_clp INTEGER NOT NULL DEFAULT 30000;
  END IF;
END $$;
