-- 005_reviews_moderation_and_media.sql
-- Agrega moderación y campos opcionales de contacto/media para reseñas.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reviews'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE reviews
      ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reviews'
      AND column_name = 'author_email'
  ) THEN
    ALTER TABLE reviews
      ADD COLUMN author_email TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reviews'
      AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE reviews
      ADD COLUMN photo_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reviews'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE reviews
      ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Estado consistente para registros existentes.
UPDATE reviews
SET status = CASE WHEN active THEN 'approved' ELSE 'pending' END
WHERE status IS DISTINCT FROM CASE WHEN active THEN 'approved' ELSE 'pending' END;

