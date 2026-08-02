import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { orders } from "./orders";
import { products } from "./products";

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id),

    authorName: text("author_name").notNull(),
    authorEmail: text("author_email"),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    photoUrl: text("photo_url"),

    verified: boolean("verified").notNull().default(false),
    active: boolean("active").notNull().default(true),
    status: text("status").notNull().default("pending"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_reviews_product").on(table.productId),
    index("idx_reviews_active").on(table.active),
  ]
);
