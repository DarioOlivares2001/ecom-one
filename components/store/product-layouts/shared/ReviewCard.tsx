import Image from "next/image";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { clsx } from "clsx";
import type { Review } from "@/lib/db/types";
import { Stars } from "./Stars";

export function ReviewCard({ review, featured = false }: { review: Review; featured?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={clsx(
        "flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4",
        featured && "border-amber-300 bg-amber-50/40"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--color-text)]">{review.author_name}</span>
            {featured && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                Destacada
              </span>
            )}
            {review.verified && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-[var(--color-success)]">
                <CheckCircle2 className="h-3 w-3" />
                Compra verificada
              </span>
            )}
          </div>
          <Stars rating={review.rating} />
        </div>
        <time className="shrink-0 text-xs text-[var(--color-text-muted)]">
          {new Date(review.created_at).toLocaleDateString("es-CL", {
            month: "short",
            year: "numeric",
          })}
        </time>
      </div>
      {review.comment &&
        (featured ? (
          <div>
            <p className="text-sm leading-relaxed text-[var(--color-text-muted)] line-clamp-3">
              {review.comment}
            </p>
            <a
              href="#reviews-list"
              className="mt-1 inline-block text-xs font-semibold text-[var(--color-primary)] hover:underline"
            >
              ver más
            </a>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">{review.comment}</p>
        ))}
      {review.photo_url && (
        <div className="relative mt-1 h-32 w-full overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-background)]">
          <Image
            src={review.photo_url}
            alt={`Foto de reseña de ${review.author_name}`}
            fill
            sizes="420px"
            className="object-cover"
          />
        </div>
      )}
    </motion.div>
  );
}
