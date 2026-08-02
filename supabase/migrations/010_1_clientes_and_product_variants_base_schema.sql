-- ============================================================
-- 010_1_clientes_and_product_variants_base_schema.sql
-- Backfill de esquema: `clientes` y `product_variants` existen y se usan
-- en producción, pero nunca tuvieron un CREATE TABLE versionado en este
-- repo (se crearon fuera de las migraciones). Las migraciones 011 y 013
-- ya hacen ALTER TABLE public.clientes asumiendo que la tabla existe, así
-- que este archivo se numera para ejecutarse ANTES de la 011 (ordena
-- lexicográficamente "010_1_..." < "011_..."), sin renombrar ningún
-- archivo existente.
--
-- Estructura capturada por introspección directa de producción
-- (information_schema / pg_constraint / pg_indexes / pg_policies el
-- 2026-07-24). CREATE TABLE ... IF NOT EXISTS: en producción, donde las
-- tablas ya existen, este archivo es un no-op.
--
-- Nota: `clientes.reset_token` / `reset_token_expires` (011) y
-- `clientes.profile_recovery_ack_at` (013) NO se incluyen acá a propósito
-- — esas columnas ya tienen su propia migración idempotente más adelante
-- en la secuencia; agregarlas acá también sería redundante.
-- ============================================================

-- ============================================================
-- TABLE: clientes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clientes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         TEXT,
  email          TEXT        NOT NULL,
  telefono       TEXT,
  rut_numero     TEXT,
  rut_dv         TEXT,
  direccion      TEXT,
  comuna         TEXT,
  total_orders   INTEGER     NOT NULL DEFAULT 0,
  total_spent    NUMERIC     NOT NULL DEFAULT 0,
  last_order_at  TIMESTAMPTZ,
  password_hash  TEXT,
  registered_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT clientes_email_key UNIQUE (email),
  CONSTRAINT clientes_rut_numero_check CHECK (rut_numero IS NULL OR rut_numero ~ '^[0-9]+$'),
  CONSTRAINT clientes_rut_dv_check CHECK (rut_dv IS NULL OR upper(rut_dv) ~ '^[0-9K]$')
);

-- Un mismo RUT (número + dígito verificador) no puede repetirse entre clientes,
-- pero solo cuando ambos campos vienen completos (muchos clientes no tienen RUT).
CREATE UNIQUE INDEX IF NOT EXISTS clientes_rut_numero_dv_key
  ON public.clientes (rut_numero, upper(rut_dv))
  WHERE (rut_numero IS NOT NULL AND rut_numero <> '' AND rut_dv IS NOT NULL AND rut_dv <> '');

-- Lookup case-insensitive por email (login, recuperación, etc.).
CREATE INDEX IF NOT EXISTS clientes_email_lower_idx
  ON public.clientes (lower(trim(email)));

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clientes_service_all" ON public.clientes;
CREATE POLICY "clientes_service_all"
  ON public.clientes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Nota: en producción `clientes` NO tiene trigger de `updated_at` (a
-- diferencia de products/orders/cliente_direcciones/product_variants).
-- No se agrega acá para no cambiar el comportamiento real.


-- ============================================================
-- TABLE: product_variants
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_variants (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID        NOT NULL REFERENCES public.products (id),
  title             TEXT        NOT NULL,
  option_values     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  price             INTEGER     NOT NULL CHECK (price >= 0),
  compare_at_price  INTEGER     CHECK (compare_at_price >= 0),
  cost_price        INTEGER     CHECK (cost_price >= 0),
  stock             INTEGER     NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url         TEXT,
  badge_text        TEXT,
  active            BOOLEAN     NOT NULL DEFAULT true,
  "position"        INTEGER     NOT NULL DEFAULT 0 CHECK ("position" >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_variants_option_values_is_object_check
    CHECK (jsonb_typeof(option_values) = 'object')
);

-- No puede haber dos variantes del mismo producto con la misma combinación
-- de opciones (ej. dos veces "color: rojo, talla: M").
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_variants_product_option_values
  ON public.product_variants (product_id, option_values);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants (product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_active     ON public.product_variants (active);
CREATE INDEX IF NOT EXISTS idx_product_variants_stock      ON public.product_variants (stock);
CREATE INDEX IF NOT EXISTS idx_product_variants_position   ON public.product_variants (product_id, "position");

DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON public.product_variants;
CREATE TRIGGER trg_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_variants_public_read" ON public.product_variants;
CREATE POLICY "product_variants_public_read"
  ON public.product_variants FOR SELECT
  USING (active = true);

DROP POLICY IF EXISTS "product_variants_service_insert" ON public.product_variants;
CREATE POLICY "product_variants_service_insert"
  ON public.product_variants FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "product_variants_service_update" ON public.product_variants;
CREATE POLICY "product_variants_service_update"
  ON public.product_variants FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "product_variants_service_delete" ON public.product_variants;
CREATE POLICY "product_variants_service_delete"
  ON public.product_variants FOR DELETE
  USING (auth.role() = 'service_role');
