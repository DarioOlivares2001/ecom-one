-- 003_store_settings_extended.sql
-- Crea store_settings si no existe todavía, luego agrega columnas nuevas de forma idempotente.

CREATE TABLE IF NOT EXISTS store_settings (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name         TEXT        NOT NULL DEFAULT 'Mi Tienda',
  store_tagline      TEXT,
  logo_url           TEXT,
  logo_square_url    TEXT,
  primary_color      TEXT        NOT NULL DEFAULT '#000000',
  accent_color       TEXT        NOT NULL DEFAULT '#FF385C',
  background_color   TEXT        NOT NULL DEFAULT '#FAFAFA',
  surface_color      TEXT        NOT NULL DEFAULT '#FFFFFF',
  text_color         TEXT        NOT NULL DEFAULT '#111111',
  text_muted_color   TEXT        NOT NULL DEFAULT '#6B7280',
  border_color       TEXT        NOT NULL DEFAULT '#E5E7EB',
  support_whatsapp   TEXT,
  support_instagram  TEXT,
  support_tiktok     TEXT,
  support_email      TEXT,
  font_display       TEXT        NOT NULL DEFAULT 'Space Grotesk',
  font_body          TEXT        NOT NULL DEFAULT 'Inter',
  free_shipping_from INTEGER     NOT NULL DEFAULT 0,
  shipping_cost      INTEGER     NOT NULL DEFAULT 0,
  estimated_days     TEXT        NOT NULL DEFAULT '3-5',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger updated_at (la función set_updated_at() ya existe desde la migración 001)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_store_settings_updated_at'
      AND tgrelid = 'store_settings'::regclass
  ) THEN
    CREATE TRIGGER trg_store_settings_updated_at
      BEFORE UPDATE ON store_settings
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- Política única: solo service_role accede
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'store_settings' AND policyname = 'store_settings_service_all'
  ) THEN
    CREATE POLICY "store_settings_service_all"
      ON store_settings FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- Agregar columnas nuevas a tablas que ya existían (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'store_settings' AND column_name = 'support_email') THEN
    ALTER TABLE store_settings ADD COLUMN support_email TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'store_settings' AND column_name = 'font_display') THEN
    ALTER TABLE store_settings ADD COLUMN font_display TEXT NOT NULL DEFAULT 'Space Grotesk';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'store_settings' AND column_name = 'font_body') THEN
    ALTER TABLE store_settings ADD COLUMN font_body TEXT NOT NULL DEFAULT 'Inter';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'store_settings' AND column_name = 'free_shipping_from') THEN
    ALTER TABLE store_settings ADD COLUMN free_shipping_from INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'store_settings' AND column_name = 'shipping_cost') THEN
    ALTER TABLE store_settings ADD COLUMN shipping_cost INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'store_settings' AND column_name = 'estimated_days') THEN
    ALTER TABLE store_settings ADD COLUMN estimated_days TEXT NOT NULL DEFAULT '3-5';
  END IF;
END $$;
