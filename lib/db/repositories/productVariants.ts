import "server-only";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { productVariants } from "@/lib/db/schema";
import type { ProductVariant } from "@/lib/db/types";

type ProductVariantRow = typeof productVariants.$inferSelect;

export function mapProductVariant(row: ProductVariantRow): ProductVariant {
  return {
    id: row.id,
    product_id: row.productId,
    title: row.title,
    option_values: row.optionValues as ProductVariant["option_values"],
    price: row.price,
    compare_at_price: row.compareAtPrice,
    cost_price: row.costPrice,
    stock: row.stock,
    image_url: row.imageUrl,
    badge_text: row.badgeText,
    active: row.active,
    position: row.position,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listVariantsByProductId(productId: string): Promise<ProductVariant[]> {
  const rows = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(asc(productVariants.position));
  return rows.map(mapProductVariant);
}

export async function listActiveVariantsByProductId(
  productId: string
): Promise<ProductVariant[]> {
  const rows = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.productId, productId), eq(productVariants.active, true)))
    .orderBy(asc(productVariants.position));
  return rows.map(mapProductVariant);
}

export async function getVariantById(id: string): Promise<ProductVariant | null> {
  const rows = await db.select().from(productVariants).where(eq(productVariants.id, id)).limit(1);
  return rows[0] ? mapProductVariant(rows[0]) : null;
}

export interface ProductVariantInsertInput {
  product_id: string;
  title: string;
  option_values?: unknown;
  price: number;
  compare_at_price?: number | null;
  cost_price?: number | null;
  stock?: number;
  image_url?: string | null;
  badge_text?: string | null;
  active?: boolean;
  position?: number;
}

export type ProductVariantUpdateInput = Partial<Omit<ProductVariantInsertInput, "product_id">>;

/** Inserción en lote (un solo round-trip) para el guardado de producto con variantes. */
export async function createProductVariants(
  inputs: ProductVariantInsertInput[]
): Promise<ProductVariant[]> {
  if (inputs.length === 0) return [];
  const rows = await db
    .insert(productVariants)
    .values(
      inputs.map((input) => ({
        productId: input.product_id,
        title: input.title,
        optionValues: input.option_values ?? {},
        price: input.price,
        compareAtPrice: input.compare_at_price ?? null,
        costPrice: input.cost_price ?? null,
        stock: input.stock ?? 0,
        imageUrl: input.image_url ?? null,
        badgeText: input.badge_text ?? null,
        active: input.active ?? true,
        position: input.position ?? 0,
      }))
    )
    .returning();
  return rows.map(mapProductVariant);
}

export async function createProductVariant(
  input: ProductVariantInsertInput
): Promise<ProductVariant> {
  const [row] = await db
    .insert(productVariants)
    .values({
      productId: input.product_id,
      title: input.title,
      optionValues: input.option_values ?? {},
      price: input.price,
      compareAtPrice: input.compare_at_price ?? null,
      costPrice: input.cost_price ?? null,
      stock: input.stock ?? 0,
      imageUrl: input.image_url ?? null,
      badgeText: input.badge_text ?? null,
      active: input.active ?? true,
      position: input.position ?? 0,
    })
    .returning();
  return mapProductVariant(row);
}

export async function updateProductVariant(
  id: string,
  input: ProductVariantUpdateInput
): Promise<ProductVariant | null> {
  const values: Record<string, unknown> = {};
  if (input.title !== undefined) values.title = input.title;
  if (input.option_values !== undefined) values.optionValues = input.option_values;
  if (input.price !== undefined) values.price = input.price;
  if (input.compare_at_price !== undefined) values.compareAtPrice = input.compare_at_price;
  if (input.cost_price !== undefined) values.costPrice = input.cost_price;
  if (input.stock !== undefined) values.stock = input.stock;
  if (input.image_url !== undefined) values.imageUrl = input.image_url;
  if (input.badge_text !== undefined) values.badgeText = input.badge_text;
  if (input.active !== undefined) values.active = input.active;
  if (input.position !== undefined) values.position = input.position;

  if (Object.keys(values).length === 0) return getVariantById(id);

  const [row] = await db
    .update(productVariants)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(productVariants.id, id))
    .returning();
  return row ? mapProductVariant(row) : null;
}

export async function deleteProductVariant(id: string): Promise<void> {
  await db.delete(productVariants).where(eq(productVariants.id, id));
}

export async function deleteVariantsByProductId(productId: string): Promise<void> {
  await db.delete(productVariants).where(eq(productVariants.productId, productId));
}
