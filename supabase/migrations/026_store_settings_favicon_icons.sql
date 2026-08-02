-- 026_store_settings_favicon_icons.sql
-- Íconos generados desde una sola imagen subida en /admin/configuracion:
-- favicon_url (32x32, ya existía) + apple_icon_url (180x180) + pwa_icon_512_url
-- (512x512, usado por app/manifest.ts para instalación PWA/Android).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'apple_icon_url'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN apple_icon_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'pwa_icon_512_url'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN pwa_icon_512_url TEXT;
  END IF;
END $$;
