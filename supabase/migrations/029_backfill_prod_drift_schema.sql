-- ============================================================
-- 029_backfill_prod_drift_schema.sql
-- PRIORIDAD 2 — Completa el repo con objetos que ya existen y se usan en
-- producción, pero que nunca tuvieron migración (grupo "b" del diff de
-- deriva de esquema, 2026-07-24/25). Todo idempotente: no-op contra
-- producción (donde ya existe), crea todo contra una base vacía.
--
-- Asume que 010_1 (clientes/product_variants) y 027 (orders_status_check)
-- ya corrieron. No depende de que 028 haya corrido, pero está pensada para
-- aplicarse después (ver nota de policies de store_settings más abajo).
-- ============================================================

-- ============================================================
-- orders.display_code — llave que usa el webhook de Flow para encontrar la
-- orden (app/api/flow/webhook/route.ts). Probablemente parte de la
-- migración "019" que nunca se guardó (ver auditoría, commit d2b90f8:
-- "...display_code en dashboard").
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS display_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS orders_display_code_idx
  ON public.orders (display_code)
  WHERE (display_code IS NOT NULL);


-- ============================================================
-- products.cost_price / has_variants / options — sistema de variantes de
-- producto, usado activamente en 21 archivos (admin de productos, catálogo,
-- carrito, checkout, upsells).
-- ============================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS has_variants BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS options JSONB,
  ADD COLUMN IF NOT EXISTS cost_price INTEGER;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_cost_price_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_cost_price_check
  CHECK ((cost_price IS NULL) OR (cost_price >= 0));

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_options_is_array_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_options_is_array_check
  CHECK ((options IS NULL) OR (jsonb_typeof(options) = 'array'));

CREATE INDEX IF NOT EXISTS idx_products_cost_price  ON public.products (cost_price);
CREATE INDEX IF NOT EXISTS idx_products_has_variants ON public.products (has_variants);


-- ============================================================
-- store_settings.order_number_offset — offset real usado para armar
-- display_code (SO + 8 dígitos). store_settings.hero_overlay_opacity — ya
-- documentado como gap conocido en ARCHITECTURE.md. Ninguna de las dos
-- tiene migración previa.
-- ============================================================
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS order_number_offset INTEGER DEFAULT 1007398;

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS hero_overlay_opacity INTEGER DEFAULT 60;


-- ============================================================
-- store_settings — índice singleton (fuerza a nivel de Postgres que la
-- tabla nunca tenga más de una fila; es la razón real por la que
-- getStoreSettings() puede confiar en .limit(1)).
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_store_settings_singleton
  ON public.store_settings ((true));


-- ============================================================
-- store_settings — recapturar las policies reales de producción.
-- Migración 003 esperaba una única policy `store_settings_service_all`;
-- en algún momento, sin migración, producción pasó a un modelo de 4
-- policies granulares (+ la de lectura pública, que 028 elimina por
-- seguridad). Acá se deja el modelo real de producción menos esa: se
-- reemplaza la policy vieja de 003 (si existiera, ej. en una base que
-- solo corrió hasta 003) por las 3 granulares reales.
-- ============================================================
DROP POLICY IF EXISTS "store_settings_service_all" ON public.store_settings;

DROP POLICY IF EXISTS "store_settings_service_insert" ON public.store_settings;
CREATE POLICY "store_settings_service_insert"
  ON public.store_settings FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "store_settings_service_update" ON public.store_settings;
CREATE POLICY "store_settings_service_update"
  ON public.store_settings FOR UPDATE
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "store_settings_service_delete" ON public.store_settings;
CREATE POLICY "store_settings_service_delete"
  ON public.store_settings FOR DELETE
  USING (auth.role() = 'service_role');


-- ============================================================
-- Bucket de Storage "products" — el 100% de las imágenes de producto vive
-- ahí (app/admin/productos/nuevo/actions.ts). Público, sin policies
-- explícitas en storage.objects en producción (no hacen falta: un bucket
-- con public=true se sirve por la ruta pública de Storage sin pasar por
-- RLS, y las escrituras van siempre por service_role, que bypassa RLS).
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- cliente_direcciones — evita que un cliente tenga dos direcciones
-- marcadas como default a la vez (regla de negocio real, sin migración).
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS cliente_direcciones_default_unique
  ON public.cliente_direcciones (cliente_id)
  WHERE (is_default = true);


-- ============================================================
-- admin_users — índice funcional para login case-insensitive. En la
-- práctica reemplaza al idx_admin_users_email plano que la migración 014
-- esperaba (ese nunca se creó en producción; el índice de active que 014
-- también esperaba, idx_admin_users_active, tampoco existe — ver 030).
-- ============================================================
CREATE INDEX IF NOT EXISTS admin_users_email_idx
  ON public.admin_users (lower(trim(email)));
