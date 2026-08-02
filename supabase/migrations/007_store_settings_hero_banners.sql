-- 007_store_settings_hero_banners.sql
-- Banners del hero (desktop/mobile) configurables desde Admin.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'store_settings'
      AND column_name = 'hero_banner_desktop_url'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN hero_banner_desktop_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'store_settings'
      AND column_name = 'hero_banner_mobile_url'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN hero_banner_mobile_url TEXT;
  END IF;
END $$;
