import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { clientes } from "./clientes";

export const clienteDirecciones = pgTable(
  "cliente_direcciones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "cascade" }),

    nombre: text("nombre").notNull().default("Casa"),
    direccion: text("direccion").notNull(),
    comuna: text("comuna").notNull(),
    region: text("region").notNull().default("Región de O'Higgins"),
    referencia: text("referencia"),
    telefono: text("telefono"),

    isDefault: boolean("is_default").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_cliente_direcciones_cliente_id").on(table.clienteId)]
);
