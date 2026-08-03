import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),

    price: integer("price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    costPrice: integer("cost_price"),

    stock: integer("stock").notNull().default(0),

    images: text("images")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),

    category: text("category"),
    tags: text("tags").array().default(sql`'{}'::text[]`),

    hasVariants: boolean("has_variants").notNull().default(false),
    options: jsonb("options"),
    variants: jsonb("variants"),

    metaTitle: text("meta_title"),
    metaDesc: text("meta_desc"),

    /** Enlace manual al producto en Dropi (solo admin, nunca visible en la tienda pública). */
    dropiProductUrl: text("dropi_product_url"),

    active: boolean("active").notNull().default(true),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),

    discountEnabled: boolean("discount_enabled").notNull().default(false),
    discountMaxPercent: numeric("discount_max_percent", {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default("0"),
    discountSteps: jsonb("discount_steps")
      .notNull()
      .default(sql`'[]'::jsonb`),
    discountLabel: text("discount_label"),

    productSections: jsonb("product_sections")
      .notNull()
      .default(sql`'[]'::jsonb`),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_products_active").on(table.active),
    index("idx_products_slug").on(table.slug),
    index("idx_products_category").on(table.category),
    index("idx_products_created").on(table.createdAt),
    index("idx_products_deleted").on(table.deletedAt),
    index("idx_products_cost_price").on(table.costPrice),
    index("idx_products_has_variants").on(table.hasVariants),
  ]
);
