-- 008_store_assets_bucket.sql
-- Bucket público para banners del hero.
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'store_assets_public_read'
  ) THEN
    CREATE POLICY "store_assets_public_read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'store-assets');
  END IF;
END $$;
