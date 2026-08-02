-- 023_store_settings_meta_pixel.sql
-- Configuración del Meta Pixel + Conversions API, editable desde /admin/configuracion.
-- meta_capi_access_token es un secreto: la UI del admin nunca lo muestra en texto
-- plano una vez guardado (ver saveSettingsAction en app/admin/configuracion/page.tsx).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'meta_pixel_id'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN meta_pixel_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'meta_capi_access_token'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN meta_capi_access_token TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'meta_pixel_enabled'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN meta_pixel_enabled BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'meta_test_event_code'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN meta_test_event_code TEXT;
  END IF;
END $$;
