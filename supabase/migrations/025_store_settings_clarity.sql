-- 025_store_settings_clarity.sql
-- Microsoft Clarity (mapas de calor + grabaciones de sesión), configurable
-- desde /admin/marketing/clarity. Sin token/secreto: el Project ID no es sensible.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'clarity_project_id'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN clarity_project_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'clarity_enabled'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN clarity_enabled BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;
