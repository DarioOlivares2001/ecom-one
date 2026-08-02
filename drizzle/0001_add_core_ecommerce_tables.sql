CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"title" text NOT NULL,
	"option_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price" integer NOT NULL,
	"compare_at_price" integer,
	"cost_price" integer,
	"stock" integer DEFAULT 0 NOT NULL,
	"image_url" text,
	"badge_text" text,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" serial NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text,
	"shipping_address" jsonb NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal" integer NOT NULL,
	"shipping_cost" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"flow_token" text,
	"flow_order" text,
	"display_code" text,
	"notes" text,
	"stock_discounted" boolean DEFAULT false NOT NULL,
	"client_ip_address" text,
	"client_user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"order_id" uuid,
	"author_name" text NOT NULL,
	"author_email" text,
	"rating" integer NOT NULL,
	"comment" text,
	"photo_url" text,
	"verified" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text,
	"email" text NOT NULL,
	"telefono" text,
	"rut_numero" text,
	"rut_dv" text,
	"direccion" text,
	"comuna" text,
	"total_orders" integer DEFAULT 0 NOT NULL,
	"total_spent" numeric DEFAULT '0' NOT NULL,
	"last_order_at" timestamp with time zone,
	"password_hash" text,
	"registered_at" timestamp with time zone,
	"reset_token" text,
	"reset_token_expires" timestamp with time zone,
	"profile_recovery_ack_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clientes_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "cliente_direcciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"nombre" text DEFAULT 'Casa' NOT NULL,
	"direccion" text NOT NULL,
	"comuna" text NOT NULL,
	"region" text DEFAULT 'Región de O''Higgins' NOT NULL,
	"referencia" text,
	"telefono" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "store_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_name" text DEFAULT 'Mi Tienda' NOT NULL,
	"store_tagline" text,
	"logo_url" text,
	"logo_square_url" text,
	"favicon_url" text,
	"apple_icon_url" text,
	"pwa_icon_512_url" text,
	"brand_text_color" text DEFAULT '#111111' NOT NULL,
	"navbar_background_color" text DEFAULT '#FFFFFF' NOT NULL,
	"navbar_text_color" text DEFAULT '#111111' NOT NULL,
	"footer_background_color" text DEFAULT '#111111' NOT NULL,
	"footer_text_color" text DEFAULT '#FFFFFF' NOT NULL,
	"theme_preset" text DEFAULT 'custom' NOT NULL,
	"branding_mode" text DEFAULT 'logo_and_text' NOT NULL,
	"logo_size_desktop" integer DEFAULT 32 NOT NULL,
	"logo_size_mobile" integer DEFAULT 28 NOT NULL,
	"brand_text_scale" numeric(4, 2) DEFAULT '1.00' NOT NULL,
	"navbar_brand_position" text DEFAULT 'left' NOT NULL,
	"navbar_menu_position" text DEFAULT 'center' NOT NULL,
	"font_heading" text DEFAULT 'Space Grotesk' NOT NULL,
	"font_body" text DEFAULT 'Inter' NOT NULL,
	"theme_manual_override" boolean DEFAULT false NOT NULL,
	"primary_color" text DEFAULT '#6D28D9' NOT NULL,
	"accent_color" text DEFAULT '#F472B6' NOT NULL,
	"background_color" text DEFAULT '#FAFAFA' NOT NULL,
	"surface_color" text DEFAULT '#FFFFFF' NOT NULL,
	"text_color" text DEFAULT '#111111' NOT NULL,
	"text_muted_color" text DEFAULT '#6B7280' NOT NULL,
	"border_color" text DEFAULT '#E5E7EB' NOT NULL,
	"support_whatsapp" text,
	"contact_email" text,
	"support_instagram" text,
	"support_tiktok" text,
	"enable_whatsapp_checkout" boolean DEFAULT false NOT NULL,
	"enable_whatsapp_fab" boolean DEFAULT true NOT NULL,
	"hero_banner_desktop_url" text,
	"hero_banner_mobile_url" text,
	"hero_overlay_mode" text DEFAULT 'gradient',
	"hero_overlay_opacity" integer DEFAULT 60,
	"order_number_offset" integer DEFAULT 1007398,
	"shipping_cost_clp" integer DEFAULT 3990 NOT NULL,
	"shipping_free_threshold_clp" integer DEFAULT 30000 NOT NULL,
	"meta_pixel_id" text,
	"meta_capi_access_token" text,
	"meta_pixel_enabled" boolean DEFAULT false NOT NULL,
	"meta_test_event_code" text,
	"clarity_project_id" text,
	"clarity_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cliente_direcciones" ADD CONSTRAINT "cliente_direcciones_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_product_variants_product_option_values" ON "product_variants" USING btree ("product_id","option_values");--> statement-breakpoint
CREATE INDEX "idx_product_variants_product_id" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_variants_active" ON "product_variants" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_product_variants_stock" ON "product_variants" USING btree ("stock");--> statement-breakpoint
CREATE INDEX "idx_product_variants_position" ON "product_variants" USING btree ("product_id","position");--> statement-breakpoint
CREATE INDEX "idx_orders_email" ON "orders" USING btree ("customer_email");--> statement-breakpoint
CREATE INDEX "idx_orders_status" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_orders_flow_token" ON "orders" USING btree ("flow_token");--> statement-breakpoint
CREATE INDEX "idx_orders_number" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "idx_orders_created" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_orders_stock_discounted" ON "orders" USING btree ("stock_discounted");--> statement-breakpoint
CREATE INDEX "idx_reviews_product" ON "reviews" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_reviews_active" ON "reviews" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_cliente_direcciones_cliente_id" ON "cliente_direcciones" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "idx_admin_users_active" ON "admin_users" USING btree ("active");

--> statement-breakpoint
-- ============================================================
-- SQL manual: constraints CHECK, índices funcionales/parciales y triggers
-- que Drizzle no genera automáticamente. Reconstruye fielmente las reglas
-- de supabase/migrations/{001,005,010_1,014,017,021,027,029}. Ver
-- MIGRATION_STATUS.md para el detalle de las dos decisiones de diseño
-- tomadas para esta tienda nueva (no reproducción byte a byte de deriva
-- de producción de otro proyecto):
--   1) trigger updated_at agregado también en "clientes" y "reviews"
--      (en el proyecto de origen faltaba solo por accidente histórico,
--      documentado explícitamente en sus migraciones, no por regla de negocio).
--   2) admin_users_email_idx (funcional) reemplaza al índice plano sobre
--      email que en producción de origen nunca llegó a crearse.
-- ============================================================

-- ── product_variants ─────────────────────────────────────────
ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_price_check" CHECK ("price" >= 0),
  ADD CONSTRAINT "product_variants_compare_at_price_check"
    CHECK ("compare_at_price" IS NULL OR "compare_at_price" >= 0),
  ADD CONSTRAINT "product_variants_cost_price_check"
    CHECK ("cost_price" IS NULL OR "cost_price" >= 0),
  ADD CONSTRAINT "product_variants_stock_check" CHECK ("stock" >= 0),
  ADD CONSTRAINT "product_variants_position_check" CHECK ("position" >= 0),
  ADD CONSTRAINT "product_variants_option_values_is_object_check"
    CHECK (jsonb_typeof("option_values") = 'object');
--> statement-breakpoint

CREATE TRIGGER trg_product_variants_updated_at
BEFORE UPDATE ON "product_variants"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

--> statement-breakpoint

-- ── orders ────────────────────────────────────────────────────
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_status_check"
    CHECK ("status" IN ('awaiting_payment', 'pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled')),
  ADD CONSTRAINT "orders_subtotal_check" CHECK ("subtotal" >= 0),
  ADD CONSTRAINT "orders_shipping_cost_check" CHECK ("shipping_cost" >= 0),
  ADD CONSTRAINT "orders_total_check" CHECK ("total" >= 0);
--> statement-breakpoint

CREATE UNIQUE INDEX "orders_display_code_idx"
  ON "orders" ("display_code")
  WHERE "display_code" IS NOT NULL;
--> statement-breakpoint

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON "orders"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

--> statement-breakpoint

-- ── reviews ───────────────────────────────────────────────────
ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
  ADD CONSTRAINT "reviews_status_check"
    CHECK ("status" IN ('pending', 'approved', 'rejected'));
--> statement-breakpoint

CREATE TRIGGER trg_reviews_updated_at
BEFORE UPDATE ON "reviews"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

--> statement-breakpoint

-- ── clientes ──────────────────────────────────────────────────
ALTER TABLE "clientes"
  ADD CONSTRAINT "clientes_rut_numero_check" CHECK ("rut_numero" IS NULL OR "rut_numero" ~ '^[0-9]+$'),
  ADD CONSTRAINT "clientes_rut_dv_check" CHECK ("rut_dv" IS NULL OR upper("rut_dv") ~ '^[0-9K]$');
--> statement-breakpoint

CREATE UNIQUE INDEX "clientes_rut_numero_dv_key"
  ON "clientes" ("rut_numero", (upper("rut_dv")))
  WHERE ("rut_numero" IS NOT NULL AND "rut_numero" <> '' AND "rut_dv" IS NOT NULL AND "rut_dv" <> '');
--> statement-breakpoint

CREATE INDEX "clientes_email_lower_idx" ON "clientes" ((lower(trim("email"))));
--> statement-breakpoint

CREATE INDEX "idx_clientes_reset_token"
  ON "clientes" ("reset_token")
  WHERE "reset_token" IS NOT NULL;
--> statement-breakpoint

CREATE TRIGGER trg_clientes_updated_at
BEFORE UPDATE ON "clientes"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

--> statement-breakpoint

-- ── cliente_direcciones ──────────────────────────────────────
CREATE UNIQUE INDEX "cliente_direcciones_default_unique"
  ON "cliente_direcciones" ("cliente_id")
  WHERE "is_default" = true;
--> statement-breakpoint

CREATE TRIGGER trg_cliente_direcciones_updated_at
BEFORE UPDATE ON "cliente_direcciones"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

--> statement-breakpoint

-- ── admin_users ───────────────────────────────────────────────
ALTER TABLE "admin_users"
  ADD CONSTRAINT "admin_users_role_check" CHECK ("role" IN ('owner', 'admin', 'operator'));
--> statement-breakpoint

CREATE INDEX "admin_users_email_idx" ON "admin_users" ((lower(trim("email"))));
--> statement-breakpoint

CREATE TRIGGER trg_admin_users_updated_at
BEFORE UPDATE ON "admin_users"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

--> statement-breakpoint

-- ── store_settings ───────────────────────────────────────────
-- Índice singleton: garantiza a nivel de Postgres que la tabla nunca
-- tenga más de una fila (store_settings es configuración única de tienda).
CREATE UNIQUE INDEX "uq_store_settings_singleton" ON "store_settings" ((true));
--> statement-breakpoint

CREATE TRIGGER trg_store_settings_updated_at
BEFORE UPDATE ON "store_settings"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

--> statement-breakpoint

-- ============================================================
-- FUNCTION: confirm_paid_order_and_decrement_stock
-- Portada tal cual desde supabase/migrations/017_orders_stock_decrement.sql,
-- sin cambios de lógica de negocio. Bloquea la orden (SELECT ... FOR UPDATE),
-- valida estado, descuenta stock de products/product_variants por cada item
-- del JSON `items`, marca stock_discounted = true y transiciona
-- status: pending -> paid (comportamiento preexistente: no transiciona
-- awaiting_payment -> paid explícitamente; se preserva intacto, ver
-- MIGRATION_STATUS.md). Idempotente vía stock_discounted. Se invoca desde
-- Drizzle con db.execute(sql`select * from confirm_paid_order_and_decrement_stock(${orderId})`)
-- en vez de una transacción JS interactiva, porque el driver neon-http es
-- HTTP stateless y no soporta transacciones interactivas multi-round-trip;
-- toda la atomicidad queda garantizada dentro de Postgres.
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_paid_order_and_decrement_stock(
  p_order_id uuid
)
RETURNS TABLE (
  order_id uuid,
  already_discounted boolean,
  decremented_lines int,
  final_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order        public.orders%ROWTYPE;
  v_item         jsonb;
  v_product_id   uuid;
  v_variant_id   uuid;
  v_quantity     int;
  v_current      int;
  v_lines        int := 0;
BEGIN
  -- Bloquear la fila de la orden para evitar carreras (webhook duplicado, mock + manual).
  SELECT * INTO v_order
    FROM public.orders
   WHERE id = p_order_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden % no encontrada', p_order_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Orden % está cancelada; no se descuenta stock', p_order_id
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Salida temprana si ya descontó stock.
  IF v_order.stock_discounted = true THEN
    RETURN QUERY SELECT v_order.id, true, 0, v_order.status;
    RETURN;
  END IF;

  -- Recorrer items y descontar (producto o variante).
  FOR v_item IN
    SELECT * FROM jsonb_array_elements(COALESCE(v_order.items, '[]'::jsonb))
  LOOP
    v_product_id := (NULLIF(v_item->>'product_id', ''))::uuid;
    v_variant_id := (NULLIF(v_item->>'variant_id', ''))::uuid;
    v_quantity   := COALESCE((v_item->>'quantity')::int, 0);

    IF v_product_id IS NULL OR v_quantity <= 0 THEN
      CONTINUE;
    END IF;

    IF v_variant_id IS NOT NULL THEN
      SELECT stock INTO v_current
        FROM public.product_variants
       WHERE id = v_variant_id
         FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variante % no existe', v_variant_id
          USING ERRCODE = 'no_data_found';
      END IF;

      IF v_current < v_quantity THEN
        RAISE EXCEPTION
          'Stock insuficiente para variante % (actual=%, requerido=%)',
          v_variant_id, v_current, v_quantity
          USING ERRCODE = 'check_violation';
      END IF;

      UPDATE public.product_variants
         SET stock = stock - v_quantity
       WHERE id = v_variant_id;
    ELSE
      SELECT stock INTO v_current
        FROM public.products
       WHERE id = v_product_id
         FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto % no existe', v_product_id
          USING ERRCODE = 'no_data_found';
      END IF;

      IF v_current < v_quantity THEN
        RAISE EXCEPTION
          'Stock insuficiente para producto % (actual=%, requerido=%)',
          v_product_id, v_current, v_quantity
          USING ERRCODE = 'check_violation';
      END IF;

      UPDATE public.products
         SET stock = stock - v_quantity
       WHERE id = v_product_id;
    END IF;

    v_lines := v_lines + 1;
  END LOOP;

  -- Marcar descontado y, si la orden estaba pending, pasarla a paid.
  UPDATE public.orders
     SET stock_discounted = true,
         status = CASE WHEN status = 'pending' THEN 'paid' ELSE status END
   WHERE id = p_order_id
   RETURNING status INTO v_order.status;

  RETURN QUERY SELECT p_order_id, false, v_lines, v_order.status;
END;
$$;

COMMENT ON FUNCTION public.confirm_paid_order_and_decrement_stock(uuid) IS
  'Idempotente. Bloquea orden, descuenta stock (producto o variante) por cada item del JSON, marca stock_discounted=true y pasa status pending→paid.';