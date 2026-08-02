-- 010_store_settings_hero_overlay_mode.sql
-- Modo de overlay del Hero: manual o automático inteligente.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'store_settings'
      AND column_name = 'hero_overlay_mode'
  ) THEN
    ALTER TABLE store_settings
      ADD COLUMN hero_overlay_mode TEXT NOT NULL DEFAULT 'manual';
  END IF;
END $$;
