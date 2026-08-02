import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { clientes } from "@/lib/db/schema";
import type { Cliente } from "@/lib/db/types";

type ClienteRow = typeof clientes.$inferSelect;

export function mapCliente(row: ClienteRow): Cliente {
  return {
    id: row.id,
    nombre: row.nombre,
    email: row.email,
    telefono: row.telefono,
    rut_numero: row.rutNumero,
    rut_dv: row.rutDv,
    direccion: row.direccion,
    comuna: row.comuna,
    total_orders: row.totalOrders,
    total_spent: Number(row.totalSpent),
    last_order_at: row.lastOrderAt ? row.lastOrderAt.toISOString() : null,
    password_hash: row.passwordHash,
    registered_at: row.registeredAt ? row.registeredAt.toISOString() : null,
    reset_token: row.resetToken,
    reset_token_expires: row.resetTokenExpires ? row.resetTokenExpires.toISOString() : null,
    profile_recovery_ack_at: row.profileRecoveryAckAt
      ? row.profileRecoveryAckAt.toISOString()
      : null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/** Búsqueda case-insensitive por email (usa el índice funcional clientes_email_lower_idx). */
export async function getClienteByEmail(email: string): Promise<Cliente | null> {
  const rows = await db
    .select()
    .from(clientes)
    .where(sql`lower(trim(${clientes.email})) = lower(trim(${email}))`)
    .limit(1);
  return rows[0] ? mapCliente(rows[0]) : null;
}

export async function getClienteById(id: string): Promise<Cliente | null> {
  const rows = await db.select().from(clientes).where(eq(clientes.id, id)).limit(1);
  return rows[0] ? mapCliente(rows[0]) : null;
}

export async function getClienteByResetToken(token: string): Promise<Cliente | null> {
  const rows = await db.select().from(clientes).where(eq(clientes.resetToken, token)).limit(1);
  return rows[0] ? mapCliente(rows[0]) : null;
}

export async function listClientesForAdmin(): Promise<Cliente[]> {
  const rows = await db.select().from(clientes).orderBy(sql`${clientes.createdAt} desc`);
  return rows.map(mapCliente);
}

export interface ClienteInsertInput {
  nombre?: string | null;
  email: string;
  telefono?: string | null;
  rut_numero?: string | null;
  rut_dv?: string | null;
  direccion?: string | null;
  comuna?: string | null;
  total_orders?: number;
  total_spent?: number;
  last_order_at?: string | null;
  password_hash?: string | null;
  registered_at?: string | null;
}

export type ClienteUpdateInput = Partial<ClienteInsertInput> & {
  reset_token?: string | null;
  reset_token_expires?: string | null;
  profile_recovery_ack_at?: string | null;
};

export async function createCliente(input: ClienteInsertInput): Promise<Cliente> {
  const [row] = await db
    .insert(clientes)
    .values({
      nombre: input.nombre ?? null,
      email: input.email,
      telefono: input.telefono ?? null,
      rutNumero: input.rut_numero ?? null,
      rutDv: input.rut_dv ?? null,
      direccion: input.direccion ?? null,
      comuna: input.comuna ?? null,
      totalOrders: input.total_orders ?? 0,
      totalSpent: input.total_spent !== undefined ? String(input.total_spent) : undefined,
      lastOrderAt: input.last_order_at ? new Date(input.last_order_at) : null,
      passwordHash: input.password_hash ?? null,
      registeredAt: input.registered_at ? new Date(input.registered_at) : null,
    })
    .returning();
  return mapCliente(row);
}

export async function updateCliente(
  id: string,
  input: ClienteUpdateInput
): Promise<Cliente | null> {
  const values: Record<string, unknown> = {};
  if (input.nombre !== undefined) values.nombre = input.nombre;
  if (input.email !== undefined) values.email = input.email;
  if (input.telefono !== undefined) values.telefono = input.telefono;
  if (input.rut_numero !== undefined) values.rutNumero = input.rut_numero;
  if (input.rut_dv !== undefined) values.rutDv = input.rut_dv;
  if (input.direccion !== undefined) values.direccion = input.direccion;
  if (input.comuna !== undefined) values.comuna = input.comuna;
  if (input.total_orders !== undefined) values.totalOrders = input.total_orders;
  if (input.total_spent !== undefined) values.totalSpent = String(input.total_spent);
  if (input.last_order_at !== undefined)
    values.lastOrderAt = input.last_order_at ? new Date(input.last_order_at) : null;
  if (input.password_hash !== undefined) values.passwordHash = input.password_hash;
  if (input.registered_at !== undefined)
    values.registeredAt = input.registered_at ? new Date(input.registered_at) : null;
  if (input.reset_token !== undefined) values.resetToken = input.reset_token;
  if (input.reset_token_expires !== undefined)
    values.resetTokenExpires = input.reset_token_expires
      ? new Date(input.reset_token_expires)
      : null;
  if (input.profile_recovery_ack_at !== undefined)
    values.profileRecoveryAckAt = input.profile_recovery_ack_at
      ? new Date(input.profile_recovery_ack_at)
      : null;

  if (Object.keys(values).length === 0) return getClienteById(id);

  const [row] = await db
    .update(clientes)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(clientes.id, id))
    .returning();
  return row ? mapCliente(row) : null;
}
