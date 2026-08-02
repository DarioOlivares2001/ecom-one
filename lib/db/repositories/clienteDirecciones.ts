import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { clienteDirecciones } from "@/lib/db/schema";
import type { ClienteDireccion } from "@/lib/db/types";

type ClienteDireccionRow = typeof clienteDirecciones.$inferSelect;

export function mapClienteDireccion(row: ClienteDireccionRow): ClienteDireccion {
  return {
    id: row.id,
    cliente_id: row.clienteId,
    nombre: row.nombre,
    direccion: row.direccion,
    comuna: row.comuna,
    region: row.region,
    referencia: row.referencia,
    telefono: row.telefono,
    is_default: row.isDefault,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listDireccionesByClienteId(
  clienteId: string
): Promise<ClienteDireccion[]> {
  const rows = await db
    .select()
    .from(clienteDirecciones)
    .where(eq(clienteDirecciones.clienteId, clienteId));
  return rows.map(mapClienteDireccion);
}

export async function getDireccionById(id: string): Promise<ClienteDireccion | null> {
  const rows = await db
    .select()
    .from(clienteDirecciones)
    .where(eq(clienteDirecciones.id, id))
    .limit(1);
  return rows[0] ? mapClienteDireccion(rows[0]) : null;
}

export async function getDefaultDireccion(clienteId: string): Promise<ClienteDireccion | null> {
  const rows = await db
    .select()
    .from(clienteDirecciones)
    .where(
      and(eq(clienteDirecciones.clienteId, clienteId), eq(clienteDirecciones.isDefault, true))
    )
    .limit(1);
  return rows[0] ? mapClienteDireccion(rows[0]) : null;
}

export interface ClienteDireccionInsertInput {
  cliente_id: string;
  nombre?: string;
  direccion: string;
  comuna: string;
  region?: string;
  referencia?: string | null;
  telefono?: string | null;
  is_default?: boolean;
}

export type ClienteDireccionUpdateInput = Partial<
  Omit<ClienteDireccionInsertInput, "cliente_id">
>;

/**
 * Si `is_default` es true, primero desmarca cualquier otra dirección default
 * del mismo cliente (el índice único parcial `cliente_direcciones_default_unique`
 * solo permite una fila con is_default=true por cliente).
 */
async function clearOtherDefaults(clienteId: string): Promise<void> {
  await db
    .update(clienteDirecciones)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(
      and(eq(clienteDirecciones.clienteId, clienteId), eq(clienteDirecciones.isDefault, true))
    );
}

export async function createDireccion(
  input: ClienteDireccionInsertInput
): Promise<ClienteDireccion> {
  if (input.is_default) {
    await clearOtherDefaults(input.cliente_id);
  }
  const [row] = await db
    .insert(clienteDirecciones)
    .values({
      clienteId: input.cliente_id,
      nombre: input.nombre ?? "Casa",
      direccion: input.direccion,
      comuna: input.comuna,
      region: input.region ?? "Región de O'Higgins",
      referencia: input.referencia ?? null,
      telefono: input.telefono ?? null,
      isDefault: input.is_default ?? false,
    })
    .returning();
  return mapClienteDireccion(row);
}

export async function updateDireccion(
  id: string,
  clienteId: string,
  input: ClienteDireccionUpdateInput
): Promise<ClienteDireccion | null> {
  if (input.is_default) {
    await clearOtherDefaults(clienteId);
  }

  const values: Record<string, unknown> = {};
  if (input.nombre !== undefined) values.nombre = input.nombre;
  if (input.direccion !== undefined) values.direccion = input.direccion;
  if (input.comuna !== undefined) values.comuna = input.comuna;
  if (input.region !== undefined) values.region = input.region;
  if (input.referencia !== undefined) values.referencia = input.referencia;
  if (input.telefono !== undefined) values.telefono = input.telefono;
  if (input.is_default !== undefined) values.isDefault = input.is_default;

  if (Object.keys(values).length === 0) return getDireccionById(id);

  const [row] = await db
    .update(clienteDirecciones)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(clienteDirecciones.id, id), eq(clienteDirecciones.clienteId, clienteId)))
    .returning();
  return row ? mapClienteDireccion(row) : null;
}

export async function deleteDireccion(id: string, clienteId: string): Promise<void> {
  await db
    .delete(clienteDirecciones)
    .where(and(eq(clienteDirecciones.id, id), eq(clienteDirecciones.clienteId, clienteId)));
}
