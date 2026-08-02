-- 009_store_settings_admin_config_columns.sql
-- Compatibilidad total para columnas usadas por app/admin/configuracion/page.tsx
-- Agrega únicamente columnas faltantes (idempotente).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'store_settings'
      AND column_name = 'store_name'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN store_name TEXT NOT NULL DEFAULT 'Mi Tienda';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'store_tagline'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN store_tagline TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN logo_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'logo_square_url'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN logo_square_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'favicon_url'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN favicon_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'brand_text_color'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN brand_text_color TEXT NOT NULL DEFAULT '#111111';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'navbar_background_color'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN navbar_background_color TEXT NOT NULL DEFAULT '#FFFFFF';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'navbar_text_color'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN navbar_text_color TEXT NOT NULL DEFAULT '#111111';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'footer_background_color'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN footer_background_color TEXT NOT NULL DEFAULT '#111111';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'footer_text_color'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN footer_text_color TEXT NOT NULL DEFAULT '#FFFFFF';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'theme_preset'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN theme_preset TEXT NOT NULL DEFAULT 'pets_purple_pink';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'branding_mode'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN branding_mode TEXT NOT NULL DEFAULT 'logo_and_text';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'logo_size_desktop'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN logo_size_desktop INTEGER NOT NULL DEFAULT 32;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'logo_size_mobile'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN logo_size_mobile INTEGER NOT NULL DEFAULT 28;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'brand_text_scale'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN brand_text_scale NUMERIC(4,2) NOT NULL DEFAULT 1.00;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'navbar_brand_position'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN navbar_brand_position TEXT NOT NULL DEFAULT 'left';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'navbar_menu_position'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN navbar_menu_position TEXT NOT NULL DEFAULT 'center';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'font_heading'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN font_heading TEXT NOT NULL DEFAULT 'Space Grotesk';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'font_body'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN font_body TEXT NOT NULL DEFAULT 'Inter';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'theme_manual_override'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN theme_manual_override BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'primary_color'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN primary_color TEXT NOT NULL DEFAULT '#6D28D9';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'accent_color'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN accent_color TEXT NOT NULL DEFAULT '#F472B6';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'background_color'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN background_color TEXT NOT NULL DEFAULT '#FAFAFA';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'surface_color'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN surface_color TEXT NOT NULL DEFAULT '#FFFFFF';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'text_color'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN text_color TEXT NOT NULL DEFAULT '#111111';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'text_muted_color'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN text_muted_color TEXT NOT NULL DEFAULT '#6B7280';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'border_color'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN border_color TEXT NOT NULL DEFAULT '#E5E7EB';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'support_whatsapp'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN support_whatsapp TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'contact_email'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN contact_email TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'support_instagram'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN support_instagram TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'support_tiktok'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN support_tiktok TEXT;
  END IF;

  -- Requeridas por tu pedido:
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'enable_whatsapp_checkout'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN enable_whatsapp_checkout BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'hero_banner_desktop_url'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN hero_banner_desktop_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'hero_banner_mobile_url'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN hero_banner_mobile_url TEXT;
  END IF;
END $$;
