import { clsx } from "clsx";
import type { ProductReviewsState } from "../types";
import { ReviewCard } from "./ReviewCard";

export function ReviewsSection({
  reviews,
  roomy = false,
}: {
  reviews: ProductReviewsState;
  /** Más aire entre bloques — usado por el tema Bienestar (foco editorial). */
  roomy?: boolean;
}) {
  const hasReviews = reviews.list.length > 0;

  return (
    <section
      className={clsx(
        "px-4 sm:px-6 lg:px-8",
        hasReviews ? (roomy ? "mt-24" : "mt-20") : "mt-14"
      )}
    >
      <div
        className={clsx(
          "flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between",
          hasReviews ? "mb-8" : "mb-3"
        )}
      >
        <div>
          <h2
            className={clsx(
              "font-display font-bold text-[var(--color-text)]",
              hasReviews ? "text-2xl sm:text-3xl" : "text-xl"
            )}
          >
            Reseñas
          </h2>
          {reviews.avgRating !== null && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-amber-500">
                {"★".repeat(Math.round(reviews.avgRating))}
                {"☆".repeat(5 - Math.round(reviews.avgRating))}
              </span>
              <span className="text-sm text-[var(--color-text-muted)]">
                {reviews.avgRating.toFixed(1)} de 5 ({reviews.list.length} opiniones)
              </span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={reviews.onWriteReview}
          className="inline-flex h-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-primary)]/35 hover:bg-[var(--color-background)]"
        >
          Escribir reseña
        </button>
      </div>

      {hasReviews ? (
        <div className="space-y-4">
          {reviews.featuredReview && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-amber-700">
                Reseña destacada
              </p>
              <ReviewCard review={reviews.featuredReview} featured />
            </div>
          )}
          <div id="reviews-list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.regularReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)]">
          Aún no hay reseñas aprobadas para este producto.
        </p>
      )}
    </section>
  );
}
