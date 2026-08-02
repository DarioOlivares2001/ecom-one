import {
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const clientes = pgTable("clientes", {
  id: uuid("id").defaultRandom().primaryKey(),

  nombre: text("nombre"),
  email: text("email").notNull().unique(),
  telefono: text("telefono"),

  rutNumero: text("rut_numero"),
  rutDv: text("rut_dv"),

  direccion: text("direccion"),
  comuna: text("comuna"),

  totalOrders: integer("total_orders").notNull().default(0),
  totalSpent: numeric("total_spent").notNull().default("0"),
  lastOrderAt: timestamp("last_order_at", { withTimezone: true }),

  passwordHash: text("password_hash"),
  registeredAt: timestamp("registered_at", { withTimezone: true }),

  resetToken: text("reset_token"),
  resetTokenExpires: timestamp("reset_token_expires", { withTimezone: true }),

  profileRecoveryAckAt: timestamp("profile_recovery_ack_at", {
    withTimezone: true,
  }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
