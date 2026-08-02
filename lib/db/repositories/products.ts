import { and, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import type { Product } from "@/lib/db/types";

type ProductRow = typeof products.$inferSelect;

export function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    price: row.price,
    compare_at_price: row.compareAtPrice,
    cost_price: row.costPrice,
    stock: row.stock,
    images: row.images,
    category: row.category,
    tags: row.tags ?? [],
    variants: row.variants as Product["variants"],
    has_variants: row.hasVariants,
    options: row.options as Product["options"],
    meta_title: row.metaTitle,
    meta_desc: row.metaDesc,
    active: row.active,
    discount_enabled: row.discountEnabled,
    discount_max_percent: Number(row.discountMaxPercent),
    discount_steps: row.discountSteps as Product["discount_steps"],
    discount_label: row.discountLabel,
    product_sections: row.productSections as Product["product_sections"],
    deleted_at: row.deletedAt ? row.deletedAt.toISOString() : null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/** Solo productos activos y no eliminados (catálogo público). */
export async function listActiveProducts(options?: { limit?: number }): Promise<Product[]> {
  const query = db
    .select()
    .from(products)
    .where(and(eq(products.active, true), isNull(products.deletedAt)))
    .orderBy(desc(products.createdAt));
  const rows = options?.limit ? await query.limit(options.limit) : await query;
  return rows.map(mapProduct);
}

/** Producto público por slug (activo, no eliminado). null si no existe/inactivo. */
export async function getActiveProductBySlug(slug: string): Promise<Product | null> {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.active, true), isNull(products.deletedAt)))
    .limit(1);
  return rows[0] ? mapProduct(rows[0]) : null;
}

/** Producto por id, sin filtrar por activo/eliminado (uso admin). */
export async function getProductById(id: string): Promise<Product | null> {
  const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return rows[0] ? mapProduct(rows[0]) : null;
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const rows = await db.select().from(products).where(sql`${products.id} = ANY(${ids})`);
  return rows.map(mapProduct);
}

/** Listado admin: incluye inactivos; excluye eliminados salvo que se pida explícitamente. */
export async function listProductsForAdmin(options?: {
  includeDeleted?: boolean;
}): Promise<Product[]> {
  const rows = await db
    .select()
    .from(products)
    .where(options?.includeDeleted ? undefined : isNull(products.deletedAt))
    .orderBy(desc(products.createdAt));
  return rows.map(mapProduct);
}

/** Candidatos activos con stock, excluyendo un producto, para upsells/recomendaciones. */
export async function listActiveProductsExcluding(
  excludeId: string,
  limit: number
): Promise<Product[]> {
  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.active, true),
        isNull(products.deletedAt),
        gt(products.stock, 0),
        ne(products.id, excludeId)
      )
    )
    .limit(limit);
  return rows.map(mapProduct);
}

/** Candidatos elegibles para upsell del carrito/checkout: activos, con stock, sin variantes. */
export async function listUpsellEligibleProducts(options?: {
  requireDiscount?: boolean;
  limit?: number;
}): Promise<Product[]> {
  const conditions = [
    eq(products.active, true),
    isNull(products.deletedAt),
    gt(products.stock, 0),
    eq(products.hasVariants, false),
  ];
  if (options?.requireDiscount) {
    conditions.push(eq(products.discountEnabled, true));
    conditions.push(sql`${products.discountMaxPercent} > 0`);
  }

  const query = db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(desc(products.createdAt));

  const rows = options?.limit ? await query.limit(options.limit) : await query;
  return rows.map(mapProduct);
}

export async function listActiveProductsByCategory(category: string): Promise<Product[]> {
  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.active, true),
        isNull(products.deletedAt),
        eq(products.category, category)
      )
    )
    .orderBy(desc(products.createdAt));
  return rows.map(mapProduct);
}

export interface ProductInsertInput {
  slug: string;
  name: string;
  description?: string | null;
  price: number;
  compare_at_price?: number | null;
  cost_price?: number | null;
  stock?: number;
  images?: string[];
  category?: string | null;
  tags?: string[];
  has_variants?: boolean;
  options?: unknown;
  variants?: unknown;
  meta_title?: string | null;
  meta_desc?: string | null;
  active?: boolean;
  discount_enabled?: boolean;
  discount_max_percent?: number;
  discount_steps?: unknown;
  discount_label?: string | null;
  product_sections?: unknown;
}

export type ProductUpdateInput = Partial<ProductInsertInput> & {
  deleted_at?: string | null;
};

function toInsertValues(input: ProductInsertInput) {
  return {
    slug: input.slug,
    name: input.name,
    description: input.description ?? null,
    price: input.price,
    compareAtPrice: input.compare_at_price ?? null,
    costPrice: input.cost_price ?? null,
    stock: input.stock ?? 0,
    images: input.images ?? [],
    category: input.category ?? null,
    tags: input.tags ?? [],
    hasVariants: input.has_variants ?? false,
    options: input.options ?? null,
    variants: input.variants ?? null,
    metaTitle: input.meta_title ?? null,
    metaDesc: input.meta_desc ?? null,
    active: input.active ?? true,
    discountEnabled: input.discount_enabled ?? false,
    discountMaxPercent:
      input.discount_max_percent !== undefined ? String(input.discount_max_percent) : undefined,
    discountSteps: input.discount_steps ?? undefined,
    discountLabel: input.discount_label ?? null,
    productSections: input.product_sections ?? undefined,
  };
}

function toUpdateValues(input: ProductUpdateInput) {
  const values: Record<string, unknown> = {};
  if (input.slug !== undefined) values.slug = input.slug;
  if (input.name !== undefined) values.name = input.name;
  if (input.description !== undefined) values.description = input.description;
  if (input.price !== undefined) values.price = input.price;
  if (input.compare_at_price !== undefined) values.compareAtPrice = input.compare_at_price;
  if (input.cost_price !== undefined) values.costPrice = input.cost_price;
  if (input.stock !== undefined) values.stock = input.stock;
  if (input.images !== undefined) values.images = input.images;
  if (input.category !== undefined) values.category = input.category;
  if (input.tags !== undefined) values.tags = input.tags;
  if (input.has_variants !== undefined) values.hasVariants = input.has_variants;
  if (input.options !== undefined) values.options = input.options;
  if (input.variants !== undefined) values.variants = input.variants;
  if (input.meta_title !== undefined) values.metaTitle = input.meta_title;
  if (input.meta_desc !== undefined) values.metaDesc = input.meta_desc;
  if (input.active !== undefined) values.active = input.active;
  if (input.discount_enabled !== undefined) values.discountEnabled = input.discount_enabled;
  if (input.discount_max_percent !== undefined)
    values.discountMaxPercent = String(input.discount_max_percent);
  if (input.discount_steps !== undefined) values.discountSteps = input.discount_steps;
  if (input.discount_label !== undefined) values.discountLabel = input.discount_label;
  if (input.product_sections !== undefined) values.productSections = input.product_sections;
  if (input.deleted_at !== undefined)
    values.deletedAt = input.deleted_at ? new Date(input.deleted_at) : null;
  return values;
}

export async function createProduct(input: ProductInsertInput): Promise<Product> {
  const [row] = await db.insert(products).values(toInsertValues(input)).returning();
  return mapProduct(row);
}

export async function updateProduct(
  id: string,
  input: ProductUpdateInput
): Promise<Product | null> {
  const values = toUpdateValues(input);
  if (Object.keys(values).length === 0) return getProductById(id);
  const [row] = await db
    .update(products)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();
  return row ? mapProduct(row) : null;
}

/** Soft delete: marca deleted_at, no borra la fila. */
export async function softDeleteProduct(id: string): Promise<void> {
  await db
    .update(products)
    .set({ deletedAt: new Date(), active: false, updatedAt: new Date() })
    .where(eq(products.id, id));
}

export async function decrementProductStock(id: string, quantity: number): Promise<void> {
  await db
    .update(products)
    .set({ stock: sql`${products.stock} - ${quantity}`, updatedAt: new Date() })
    .where(eq(products.id, id));
}
