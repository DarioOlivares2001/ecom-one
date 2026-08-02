import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { products } from "./products";

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),

    title: text("title").notNull(),
    optionValues: jsonb("option_values")
      .notNull()
      .default(sql`'{}'::jsonb`),

    price: integer("price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    costPrice: integer("cost_price"),

    stock: integer("stock").notNull().default(0),

    imageUrl: text("image_url"),
    badgeText: text("badge_text"),

    active: boolean("active").notNull().default(true),
    position: integer("position").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_product_variants_product_option_values").on(
      table.productId,
      table.optionValues
    ),
    index("idx_product_variants_product_id").on(table.productId),
    index("idx_product_variants_active").on(table.active),
    index("idx_product_variants_stock").on(table.stock),
    index("idx_product_variants_position").on(table.productId, table.position),
  ]
);
