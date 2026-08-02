import { and, count, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { products, reviews } from "@/lib/db/schema";
import type { Review } from "@/lib/db/types";

type ReviewRow = typeof reviews.$inferSelect;

export function mapReview(row: ReviewRow): Review {
  return {
    id: row.id,
    product_id: row.productId,
    order_id: row.orderId,
    author_name: row.authorName,
    author_email: row.authorEmail,
    rating: row.rating,
    comment: row.comment,
    photo_url: row.photoUrl,
    verified: row.verified,
    active: row.active,
    status: row.status as Review["status"],
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listActiveReviewsByProductId(productId: string): Promise<Review[]> {
  const rows = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.active, true)))
    .orderBy(desc(reviews.createdAt));
  return rows.map(mapReview);
}

export async function listReviewsForAdmin(): Promise<Review[]> {
  const rows = await db.select().from(reviews).orderBy(desc(reviews.createdAt));
  return rows.map(mapReview);
}

export interface AdminReviewWithProduct extends Review {
  product_name: string | null;
  product_price: number | null;
}

/** Reseñas por estado, con nombre/precio actual del producto (para /admin/resenas). */
export async function listReviewsByStatusWithProduct(
  status: Review["status"]
): Promise<AdminReviewWithProduct[]> {
  const rows = await db
    .select({
      review: reviews,
      productName: products.name,
      productPrice: products.price,
    })
    .from(reviews)
    .leftJoin(products, eq(reviews.productId, products.id))
    .where(eq(reviews.status, status))
    .orderBy(desc(reviews.createdAt));

  return rows.map(({ review, productName, productPrice }) => ({
    ...mapReview(review),
    product_name: productName ?? null,
    product_price: productPrice ?? null,
  }));
}

export async function countReviewsByStatus(): Promise<{
  pending: number;
  approved: number;
  rejected: number;
}> {
  const rows = await db
    .select({ status: reviews.status, total: count() })
    .from(reviews)
    .groupBy(reviews.status);

  const result = { pending: 0, approved: 0, rejected: 0 };
  for (const row of rows) {
    if (row.status === "pending" || row.status === "approved" || row.status === "rejected") {
      result[row.status] = Number(row.total);
    }
  }
  return result;
}

export async function getReviewById(id: string): Promise<Review | null> {
  const rows = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
  return rows[0] ? mapReview(rows[0]) : null;
}

export interface ReviewInsertInput {
  product_id: string;
  order_id?: string | null;
  author_name: string;
  author_email?: string | null;
  rating: number;
  comment?: string | null;
  photo_url?: string | null;
  verified?: boolean;
  active?: boolean;
  status?: Review["status"];
}

export async function createReview(input: ReviewInsertInput): Promise<Review> {
  const [row] = await db
    .insert(reviews)
    .values({
      productId: input.product_id,
      orderId: input.order_id ?? null,
      authorName: input.author_name,
      authorEmail: input.author_email ?? null,
      rating: input.rating,
      comment: input.comment ?? null,
      photoUrl: input.photo_url ?? null,
      verified: input.verified ?? false,
      active: input.active ?? true,
      status: input.status ?? "pending",
    })
    .returning();
  return mapReview(row);
}

export async function updateReviewStatus(
  id: string,
  status: Review["status"],
  options?: { active?: boolean }
): Promise<Review | null> {
  const [row] = await db
    .update(reviews)
    .set({
      status,
      ...(options?.active !== undefined ? { active: options.active } : {}),
      updatedAt: new Date(),
    })
    .where(eq(reviews.id, id))
    .returning();
  return row ? mapReview(row) : null;
}

export async function deleteReview(id: string): Promise<void> {
  await db.delete(reviews).where(eq(reviews.id, id));
}

/** Oculta una reseña que esté aprobada (no-op si no está en ese estado). */
export async function hideApprovedReview(id: string): Promise<void> {
  await db
    .update(reviews)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(reviews.id, id), eq(reviews.status, "approved")));
}
