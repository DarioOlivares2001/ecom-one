CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" integer NOT NULL,
	"compare_at_price" integer,
	"cost_price" integer,
	"stock" integer DEFAULT 0 NOT NULL,
	"images" text[] DEFAULT '{}'::text[] NOT NULL,
	"category" text,
	"tags" text[] DEFAULT '{}'::text[],
	"has_variants" boolean DEFAULT false NOT NULL,
	"options" jsonb,
	"variants" jsonb,
	"meta_title" text,
	"meta_desc" text,
	"active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"discount_enabled" boolean DEFAULT false NOT NULL,
	"discount_max_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"discount_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"discount_label" text,
	"product_sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "idx_products_active" ON "products" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_products_slug" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_products_category" ON "products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_products_created" ON "products" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_products_deleted" ON "products" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_products_cost_price" ON "products" USING btree ("cost_price");--> statement-breakpoint
CREATE INDEX "idx_products_has_variants" ON "products" USING btree ("has_variants");


--> statement-breakpoint
ALTER TABLE "products"
  ADD CONSTRAINT "products_price_check" CHECK ("price" >= 0),
  ADD CONSTRAINT "products_compare_at_price_check"
    CHECK ("compare_at_price" IS NULL OR "compare_at_price" >= 0),
  ADD CONSTRAINT "products_cost_price_check"
    CHECK ("cost_price" IS NULL OR "cost_price" >= 0),
  ADD CONSTRAINT "products_stock_check" CHECK ("stock" >= 0),
  ADD CONSTRAINT "products_discount_max_percent_range"
    CHECK ("discount_max_percent" >= 0 AND "discount_max_percent" <= 100),
  ADD CONSTRAINT "products_discount_steps_is_array"
    CHECK (jsonb_typeof("discount_steps") = 'array'),
  ADD CONSTRAINT "products_product_sections_is_array"
    CHECK (jsonb_typeof("product_sections") = 'array'),
  ADD CONSTRAINT "products_options_is_array_check"
    CHECK ("options" IS NULL OR jsonb_typeof("options") = 'array');

--> statement-breakpoint
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON "products"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();