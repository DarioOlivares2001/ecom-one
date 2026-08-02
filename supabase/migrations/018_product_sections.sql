-- ============================================================
-- 018_product_sections.sql
-- Bloques modulares de la ficha de producto (benefits, media_strip,
-- faq, testimonials, ...). Validación de schema se hace en el backend
-- (Zod en server actions), aquí solo nos aseguramos que sea un array JSON.
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_sections jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_product_sections_is_array;

ALTER TABLE public.products
  ADD CONSTRAINT products_product_sections_is_array
  CHECK (jsonb_typeof(product_sections) = 'array');

COMMENT ON COLUMN public.products.product_sections IS
  'Lista ordenada de bloques modulares de la ficha. Cada item: { id, type, enabled, order, data }.';
