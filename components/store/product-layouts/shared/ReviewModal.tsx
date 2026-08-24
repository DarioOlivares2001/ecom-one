"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Star, X } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";

interface ReviewModalProps {
  productId: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Modal de "Escribir reseña" — mismo flujo de 5 pasos en todos los temas
 * estructurales (no es parte de la composición que cada layout decide).
 * Dueño de su propio estado de formulario/envío; solo necesita el id del
 * producto y si está abierto.
 */
export function ReviewModal({ productId, open, onClose }: ReviewModalProps) {
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string | null>(null);
  const [reviewErrorMsg, setReviewErrorMsg] = useState<string | null>(null);
  const [reviewStep, setReviewStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [showPhotoInput, setShowPhotoInput] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    rating: 0,
    author_name: "",
    author_email: "",
    comment: "",
    photo_url: "",
  });
  const ratingAdvanceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setReviewSuccessMsg(null);
    setReviewErrorMsg(null);
    setShowPhotoInput(false);
    setReviewStep(1);
  }, [open]);

  useEffect(() => {
    return () => {
      if (ratingAdvanceTimerRef.current) {
        window.clearTimeout(ratingAdvanceTimerRef.current);
      }
    };
  }, []);

  async function submitReview() {
    if (reviewSubmitting) return;
    setReviewErrorMsg(null);
    setReviewSuccessMsg(null);
    setReviewSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          rating: reviewForm.rating,
          author_name: reviewForm.author_name.trim(),
          author_email: reviewForm.author_email.trim(),
          comment: reviewForm.comment.trim(),
          photo_url: reviewForm.photo_url.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setReviewErrorMsg(data.error ?? "No pudimos enviar tu reseña.");
        return;
      }
      setReviewSuccessMsg("Gracias, tu reseña será revisada antes de publicarse.");
      setReviewForm({ rating: 0, author_name: "", author_email: "", comment: "", photo_url: "" });
      setShowPhotoInput(false);
      setReviewStep(5);
    } catch {
      setReviewErrorMsg("No pudimos enviar tu reseña.");
    } finally {
      setReviewSubmitting(false);
    }
  }

  function handleSelectRating(rating: number) {
    setReviewForm((p) => ({ ...p, rating }));
    if (ratingAdvanceTimerRef.current) {
      window.clearTimeout(ratingAdvanceTimerRef.current);
    }
    ratingAdvanceTimerRef.current = window.setTimeout(() => {
      setReviewStep(2);
    }, 500);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] hidden bg-black/45 backdrop-blur-[1px] md:block"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed inset-0 z-[81] bg-[var(--color-surface)] md:left-1/2 md:top-1/2 md:h-auto md:max-h-[88vh] md:w-[92vw] md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[var(--radius-lg)] md:border md:border-[var(--color-border)] md:shadow-[0_22px_48px_rgba(0,0,0,0.28)]"
          >
            <div className="flex h-full max-h-screen flex-col">
              <div className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 md:px-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-[var(--color-text)] md:text-xl">
                      Escribir reseña
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      {reviewStep <= 4 ? `Paso ${reviewStep} de 4` : "Enviado"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Cerrar"
                    className="rounded-full p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-border)]/40 hover:text-[var(--color-text)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {reviewStep <= 4 && (
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--color-border)]/50">
                    <div
                      className="h-full bg-brand-gradient transition-all duration-300"
                      style={{ width: `${(reviewStep / 4) * 100}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 md:px-5">
                <AnimatePresence mode="wait">
                  {reviewStep === 1 && (
                    <motion.div
                      key="step-1"
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -18 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="mx-auto flex max-w-sm flex-col items-center justify-center py-8 text-center"
                    >
                      <h4 className="font-display text-xl font-bold text-[var(--color-text)]">
                        ¿Qué te pareció el producto?
                      </h4>
                      <div className="mt-5 flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((n, idx) => (
                          <motion.button
                            key={n}
                            type="button"
                            onClick={() => handleSelectRating(n)}
                            aria-label={`Calificar con ${n} estrellas`}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.04, duration: 0.18 }}
                            whileTap={{ scale: 0.9 }}
                            whileHover={{ scale: 1.08 }}
                            className="rounded p-0.5"
                          >
                            <motion.span
                              animate={n === reviewForm.rating ? { scale: [1, 1.24, 1] } : { scale: 1 }}
                              transition={{ duration: 0.34 }}
                              className="inline-flex"
                            >
                              <Star
                                className={clsx(
                                  "h-9 w-9",
                                  n <= reviewForm.rating
                                    ? "fill-amber-400 text-amber-400"
                                    : "fill-zinc-200 text-zinc-200"
                                )}
                              />
                            </motion.span>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {reviewStep === 2 && (
                    <motion.div
                      key="step-2"
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -18 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="mx-auto max-w-md space-y-4 py-3"
                    >
                      <h4 className="font-display text-xl font-bold text-[var(--color-text)]">
                        ¿Tienes una foto del producto?
                      </h4>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Ayuda a otros clientes mostrando cómo se ve en casa.
                      </p>
                      {!showPhotoInput ? (
                        <button
                          type="button"
                          onClick={() => setShowPhotoInput(true)}
                          className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-primary)]/35"
                        >
                          Agregar foto
                        </button>
                      ) : (
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-[var(--color-text)]">URL de foto</span>
                          <input
                            type="url"
                            value={reviewForm.photo_url}
                            onChange={(e) => setReviewForm((p) => ({ ...p, photo_url: e.target.value }))}
                            placeholder="https://..."
                            className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/35"
                          />
                        </label>
                      )}
                    </motion.div>
                  )}

                  {reviewStep === 3 && (
                    <motion.div
                      key="step-3"
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -18 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="mx-auto max-w-md space-y-3 py-3"
                    >
                      <h4 className="font-display text-xl font-bold text-[var(--color-text)]">
                        Cuéntanos tu experiencia
                      </h4>
                      <textarea
                        required
                        rows={7}
                        value={reviewForm.comment}
                        onChange={(e) => setReviewForm((p) => ({ ...p, comment: e.target.value }))}
                        placeholder="¿Qué te gustó del producto?"
                        className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/35"
                      />
                    </motion.div>
                  )}

                  {reviewStep === 4 && (
                    <motion.div
                      key="step-4"
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -18 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="mx-auto max-w-md space-y-3 py-3"
                    >
                      <h4 className="font-display text-xl font-bold text-[var(--color-text)]">Último paso</h4>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-[var(--color-text)]">Nombre completo</span>
                        <input
                          required
                          value={reviewForm.author_name}
                          onChange={(e) => setReviewForm((p) => ({ ...p, author_name: e.target.value }))}
                          className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/35"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-[var(--color-text)]">Email (opcional)</span>
                        <input
                          type="email"
                          value={reviewForm.author_email}
                          onChange={(e) => setReviewForm((p) => ({ ...p, author_email: e.target.value }))}
                          className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/35"
                        />
                      </label>
                    </motion.div>
                  )}

                  {reviewStep === 5 && (
                    <motion.div
                      key="step-5"
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -18 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="mx-auto flex max-w-sm flex-col items-center justify-center py-10 text-center"
                    >
                      <h4 className="font-display text-2xl font-bold text-[var(--color-text)]">
                        Gracias por tu reseña
                      </h4>
                      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                        La revisaremos antes de publicarla.
                      </p>
                      {reviewSuccessMsg && (
                        <p className="mt-3 text-xs font-semibold text-emerald-700">{reviewSuccessMsg}</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="sticky bottom-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 md:px-5">
                {reviewErrorMsg && (
                  <p className="mb-2 text-xs font-semibold text-rose-600">{reviewErrorMsg}</p>
                )}
                <div className="flex items-center gap-2">
                  {reviewStep === 2 && (
                    <Button variant="secondary" fullWidth onClick={() => setReviewStep(3)}>
                      Omitir por ahora
                    </Button>
                  )}
                  {reviewStep === 3 && (
                    <Button
                      fullWidth
                      onClick={() => setReviewStep(4)}
                      disabled={reviewForm.comment.trim().length < 3}
                    >
                      Continuar
                    </Button>
                  )}
                  {reviewStep === 4 && (
                    <Button
                      fullWidth
                      loading={reviewSubmitting}
                      onClick={submitReview}
                      disabled={reviewForm.author_name.trim().length < 2 || reviewForm.rating < 1}
                    >
                      Enviar reseña
                    </Button>
                  )}
                  {reviewStep === 5 && (
                    <Button fullWidth onClick={onClose}>
                      Cerrar
                    </Button>
                  )}
                  {reviewStep === 1 && (
                    <Button variant="secondary" fullWidth onClick={onClose}>
                      Cerrar
                    </Button>
                  )}
                  {reviewStep === 2 && showPhotoInput && (
                    <Button fullWidth onClick={() => setReviewStep(3)}>
                      Continuar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
