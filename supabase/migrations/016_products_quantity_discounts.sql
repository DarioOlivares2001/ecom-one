-- Descuentos por cantidad (configuración en producto; aplicación en etapas posteriores)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS discount_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discount_max_percent numeric(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS discount_label text NULL;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_discount_max_percent_range;

ALTER TABLE public.products
  ADD CONSTRAINT products_discount_max_percent_range
  CHECK (discount_max_percent >= 0 AND discount_max_percent <= 100);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_discount_steps_is_array;

ALTER TABLE public.products
  ADD CONSTRAINT products_discount_steps_is_array
  CHECK (jsonb_typeof(discount_steps) = 'array');

COMMENT ON COLUMN public.products.discount_enabled IS 'Si true, aplican discount_steps con tope discount_max_percent.';
COMMENT ON COLUMN public.products.discount_max_percent IS 'Tope % de descuento por cantidad (0–100).';
COMMENT ON COLUMN public.products.discount_steps IS 'JSON [{ "minQty": number, "percent": number }, ...] ordenable por minQty.';
COMMENT ON COLUMN public.products.discount_label IS 'Texto opcional para mostrar en tienda (ej. “Más unidades, mejor precio”).';
