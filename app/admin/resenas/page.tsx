import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import {
  countReviewsByStatus,
  hideApprovedReview,
  listReviewsByStatusWithProduct,
  updateReviewStatus,
} from "@/lib/db/repositories";
import { formatPrice } from "@/lib/utils/format";
import { getAdminSessionFromCookies } from "@/lib/admin/session";
import { ReviewActions } from "./ReviewActions";

export const metadata: Metadata = { title: "Reseñas" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ReviewStatusTab = "pending" | "approved" | "rejected";

async function approveReviewAction(id: string): Promise<{ error?: string }> {
  "use server";
  if (!getAdminSessionFromCookies()) {
    return { error: "No autorizado." };
  }
  const trimmedId = id.trim();
  if (!trimmedId) return { error: "ID de reseña inválido." };

  try {
    await updateReviewStatus(trimmedId, "approved", { active: true });
  } catch (error) {
    console.error("[admin/resenas] Error aprobando reseña:", error);
    return { error: "No se pudo aprobar la reseña." };
  }

  revalidatePath("/admin/resenas");
  revalidatePath("/productos");
  return {};
}

async function rejectReviewAction(id: string): Promise<{ error?: string }> {
  "use server";
  if (!getAdminSessionFromCookies()) {
    return { error: "No autorizado." };
  }
  const trimmedId = id.trim();
  if (!trimmedId) return { error: "ID de reseña inválido." };

  try {
    await updateReviewStatus(trimmedId, "rejected", { active: false });
  } catch (error) {
    console.error("[admin/resenas] Error rechazando reseña:", error);
    return { error: "No se pudo rechazar la reseña." };
  }

  revalidatePath("/admin/resenas");
  return {};
}

async function hideApprovedReviewAction(id: string): Promise<{ error?: string }> {
  "use server";
  if (!getAdminSessionFromCookies()) {
    return { error: "No autorizado." };
  }
  const trimmedId = id.trim();
  if (!trimmedId) return { error: "ID de reseña inválido." };

  try {
    await hideApprovedReview(trimmedId);
  } catch (error) {
    console.error("[admin/resenas] Error ocultando reseña aprobada:", error);
    return { error: "No se pudo ocultar la reseña." };
  }

  revalidatePath("/admin/resenas");
  return {};
}

async function getReviewsByStatus(status: ReviewStatusTab) {
  try {
    const rows = await listReviewsByStatusWithProduct(status);
    return rows.map((row) => ({
      ...row,
      products: { name: row.product_name, price: row.product_price },
    }));
  } catch (error) {
    console.error("[admin/resenas] Error cargando reseñas:", error);
    return [];
  }
}

async function getReviewCounts() {
  try {
    return await countReviewsByStatus();
  } catch (error) {
    console.error("[admin/resenas] Error cargando conteos de reseñas:", error);
    return { pending: 0, approved: 0, rejected: 0 };
  }
}

function starsBadge(rating: number) {
  const safe = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
      <span>{"★".repeat(safe)}{"☆".repeat(5 - safe)}</span>
      <span>{safe}/5</span>
    </span>
  );
}

function statusBadge(status: ReviewStatusTab) {
  if (status === "approved") {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
        Aprobada
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
        Rechazada
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
      Pendiente
    </span>
  );
}

export default async function AdminResenasPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const tab =
    searchParams?.tab === "approved" || searchParams?.tab === "rejected"
      ? searchParams.tab
      : "pending";
  const counts = await getReviewCounts();
  const reviews = await getReviewsByStatus(tab);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">Gestión de reseñas</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Modera reseñas por estado: pendientes, aprobadas y rechazadas.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/resenas?tab=pending"
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            tab === "pending"
              ? "bg-zinc-900 text-white"
              : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
          }`}
        >
          Pendientes ({counts.pending})
        </Link>
        <Link
          href="/admin/resenas?tab=approved"
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            tab === "approved"
              ? "bg-zinc-900 text-white"
              : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
          }`}
        >
          Aprobadas ({counts.approved})
        </Link>
        <Link
          href="/admin/resenas?tab=rejected"
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            tab === "rejected"
              ? "bg-zinc-900 text-white"
              : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
          }`}
        >
          Rechazadas ({counts.rejected})
        </Link>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm">
          No hay reseñas en esta pestaña.
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const product = Array.isArray(review.products) ? review.products[0] : review.products;
            const productName = product?.name ?? "Producto eliminado";
            return (
              <article
                key={review.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-900">{productName}</p>
                    <p className="text-xs text-zinc-500">
                      {review.created_at
                        ? new Date(review.created_at).toLocaleString("es-CL")
                        : "Sin fecha"}
                    </p>
                    {typeof product?.price === "number" ? (
                      <p className="text-xs text-zinc-500">Precio actual: {formatPrice(product.price)}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(review.status)}
                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                      {review.active ? "Visible" : "Oculta"}
                    </span>
                    {starsBadge(review.rating)}
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
                    <p>
                      <span className="font-semibold text-zinc-900">Autor:</span> {review.author_name}
                    </p>
                    {review.author_email ? (
                      <p>
                        <span className="font-semibold text-zinc-900">Email:</span> {review.author_email}
                      </p>
                    ) : (
                      <p className="text-zinc-500">Email no informado</p>
                    )}
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-900">Comentario</p>
                    <p className="mt-1 whitespace-pre-wrap">{review.comment}</p>
                  </div>
                </div>

                {review.photo_url ? (
                  <div className="mt-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={review.photo_url}
                      alt={`Foto reseña ${review.author_name}`}
                      className="h-28 w-28 rounded-lg border border-zinc-200 object-cover"
                    />
                  </div>
                ) : null}

                <ReviewActions
                  reviewId={review.id}
                  status={review.status}
                  active={review.active}
                  approveAction={approveReviewAction}
                  rejectAction={rejectReviewAction}
                  hideAction={hideApprovedReviewAction}
                />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

