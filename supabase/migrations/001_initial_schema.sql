-- ============================================================
-- 001_initial_schema.sql
-- TheGate — Schema inicial
-- Tablas: products, orders, reviews, customers
-- ============================================================

-- Trigger helper: actualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- TABLE: products
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT        UNIQUE NOT NULL,
  name             TEXT        NOT NULL,
  description      TEXT,
  price            INTEGER     NOT NULL CHECK (price >= 0),
  compare_at_price INTEGER     CHECK (compare_at_price >= 0),
  stock            INTEGER     NOT NULL DEFAULT 0 CHECK (stock >= 0),
  images           TEXT[]      NOT NULL DEFAULT '{}',
  category         TEXT,
  tags             TEXT[]      DEFAULT '{}',
  variants         JSONB,
  meta_title       TEXT,
  meta_desc        TEXT,
  active           BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_products_active   ON products (active);
CREATE INDEX idx_products_slug     ON products (slug);
CREATE INDEX idx_products_category ON products (category);
CREATE INDEX idx_products_created  ON products (created_at DESC);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_public_read"
  ON products FOR SELECT
  USING (active = true);

CREATE POLICY "products_service_insert"
  ON products FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "products_service_update"
  ON products FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "products_service_delete"
  ON products FOR DELETE
  USING (auth.role() = 'service_role');


-- ============================================================
-- TABLE: orders
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number     SERIAL      UNIQUE NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN (
                                 'pending', 'paid', 'shipped', 'delivered', 'cancelled'
                               )),
  customer_name    TEXT        NOT NULL,
  customer_email   TEXT        NOT NULL,
  customer_phone   TEXT,
  shipping_address JSONB       NOT NULL,
  items            JSONB       NOT NULL DEFAULT '[]',
  subtotal         INTEGER     NOT NULL CHECK (subtotal >= 0),
  shipping_cost    INTEGER     NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  total            INTEGER     NOT NULL CHECK (total >= 0),
  flow_token       TEXT,
  flow_order       TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_orders_email      ON orders (customer_email);
CREATE INDEX idx_orders_status     ON orders (status);
CREATE INDEX idx_orders_flow_token ON orders (flow_token);
CREATE INDEX idx_orders_number     ON orders (order_number DESC);
CREATE INDEX idx_orders_created    ON orders (created_at DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_anon_insert"
  ON orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "orders_anon_update_flow_token"
  ON orders FOR UPDATE
  USING (status = 'pending' AND flow_token IS NULL)
  WITH CHECK (status = 'pending');

CREATE POLICY "orders_service_select"
  ON orders FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "orders_service_update"
  ON orders FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "orders_service_delete"
  ON orders FOR DELETE
  USING (auth.role() = 'service_role');


-- ============================================================
-- TABLE: reviews
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID        NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  order_id    UUID        REFERENCES orders (id),
  author_name TEXT        NOT NULL,
  rating      INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  verified    BOOLEAN     NOT NULL DEFAULT false,
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_product ON reviews (product_id);
CREATE INDEX idx_reviews_active  ON reviews (active);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_public_read"
  ON reviews FOR SELECT
  USING (active = true);

CREATE POLICY "reviews_public_insert"
  ON reviews FOR INSERT
  WITH CHECK (true);

CREATE POLICY "reviews_service_update"
  ON reviews FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "reviews_service_delete"
  ON reviews FOR DELETE
  USING (auth.role() = 'service_role');


-- ============================================================
-- TABLE: customers
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT        UNIQUE NOT NULL,
  name         TEXT,
  phone        TEXT,
  addresses    JSONB[]     DEFAULT '{}',
  total_orders INTEGER     NOT NULL DEFAULT 0 CHECK (total_orders >= 0),
  total_spent  INTEGER     NOT NULL DEFAULT 0 CHECK (total_spent >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_email ON customers (email);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_service_all"
  ON customers FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
