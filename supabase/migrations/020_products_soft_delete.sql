ALTER TABLE products
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_products_deleted ON products (deleted_at)
  WHERE deleted_at IS NOT NULL;
