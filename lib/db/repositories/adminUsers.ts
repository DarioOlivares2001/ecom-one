import { and, count, eq, ne, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { adminUsers } from "@/lib/db/schema";
import type { AdminUser } from "@/lib/db/types";

type AdminUserRow = typeof adminUsers.$inferSelect;

export function mapAdminUser(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    email: row.email,
    password_hash: row.passwordHash,
    role: row.role as AdminUser["role"],
    active: row.active,
    last_login_at: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/** Búsqueda case-insensitive por email (usa el índice funcional admin_users_email_idx). */
export async function getAdminUserByEmail(email: string): Promise<AdminUser | null> {
  const rows = await db
    .select()
    .from(adminUsers)
    .where(sql`lower(trim(${adminUsers.email})) = lower(trim(${email}))`)
    .limit(1);
  return rows[0] ? mapAdminUser(rows[0]) : null;
}

export async function getAdminUserById(id: string): Promise<AdminUser | null> {
  const rows = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  return rows[0] ? mapAdminUser(rows[0]) : null;
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const rows = await db.select().from(adminUsers).orderBy(sql`${adminUsers.createdAt} desc`);
  return rows.map(mapAdminUser);
}

/** Cuenta owners activos, excluyendo opcionalmente un id (para el guard "no dejar la tienda sin owner"). */
export async function countActiveOwners(excludeId?: string): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(adminUsers)
    .where(
      excludeId
        ? and(eq(adminUsers.role, "owner"), eq(adminUsers.active, true), ne(adminUsers.id, excludeId))
        : and(eq(adminUsers.role, "owner"), eq(adminUsers.active, true))
    );
  return rows[0]?.value ?? 0;
}

export interface AdminUserInsertInput {
  email: string;
  password_hash: string;
  role?: AdminUser["role"];
  active?: boolean;
}

export type AdminUserUpdateInput = Partial<AdminUserInsertInput> & {
  last_login_at?: string | null;
};

export async function createAdminUser(input: AdminUserInsertInput): Promise<AdminUser> {
  const [row] = await db
    .insert(adminUsers)
    .values({
      email: input.email,
      passwordHash: input.password_hash,
      role: input.role ?? "admin",
      active: input.active ?? true,
    })
    .returning();
  return mapAdminUser(row);
}

export async function updateAdminUser(
  id: string,
  input: AdminUserUpdateInput
): Promise<AdminUser | null> {
  const values: Record<string, unknown> = {};
  if (input.email !== undefined) values.email = input.email;
  if (input.password_hash !== undefined) values.passwordHash = input.password_hash;
  if (input.role !== undefined) values.role = input.role;
  if (input.active !== undefined) values.active = input.active;
  if (input.last_login_at !== undefined)
    values.lastLoginAt = input.last_login_at ? new Date(input.last_login_at) : null;

  if (Object.keys(values).length === 0) return getAdminUserById(id);

  const [row] = await db
    .update(adminUsers)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(adminUsers.id, id))
    .returning();
  return row ? mapAdminUser(row) : null;
}
