-- 006_store_settings_contact_email.sql
-- Email de contacto para notificaciones (ej. reseñas pendientes).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'store_settings'
      AND column_name = 'contact_email'
  ) THEN
    ALTER TABLE store_settings
      ADD COLUMN contact_email TEXT;
  END IF;
END $$;

