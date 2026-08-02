import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderNumber: serial("order_number").notNull().unique(),

    status: text("status").notNull().default("pending"),

    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone"),

    shippingAddress: jsonb("shipping_address").notNull(),
    items: jsonb("items")
      .notNull()
      .default(sql`'[]'::jsonb`),

    subtotal: integer("subtotal").notNull(),
    shippingCost: integer("shipping_cost").notNull().default(0),
    total: integer("total").notNull(),

    flowToken: text("flow_token"),
    flowOrder: text("flow_order"),
    displayCode: text("display_code"),
    notes: text("notes"),

    stockDiscounted: boolean("stock_discounted").notNull().default(false),

    clientIpAddress: text("client_ip_address"),
    clientUserAgent: text("client_user_agent"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_orders_email").on(table.customerEmail),
    index("idx_orders_status").on(table.status),
    index("idx_orders_flow_token").on(table.flowToken),
    index("idx_orders_number").on(table.orderNumber),
    index("idx_orders_created").on(table.createdAt),
    index("idx_orders_stock_discounted").on(table.stockDiscounted),
  ]
);
