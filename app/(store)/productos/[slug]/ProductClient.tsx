"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  Star,
  X,
  ShoppingBag,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
} from "lucide-react";
import { clsx } from "clsx";
import { useCartStore } from "@/lib/cart/store";
import { pixelEvents } from "@/lib/pixel/events";
import { formatPrice } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toast";
import { StickyAddToCart } from "@/components/store/StickyAddToCart";
import { TrustBadges } from "@/components/store/TrustBadges";
import { normalizeProductCategory } from "@/lib/product/categories";
import type { Database, Product, Review } from "@/lib/supabase/types";
import type { ProductUpsellSuggestion } from "@/lib/product/upsell";
import {
  ProductSectionsRenderer,
  hasVisibleProductSections,
} from "@/components/store/product-sections/ProductSectionsRenderer";

interface Props {
  product: Product;
  reviews: Review[];
  variants: Database["public"]["Tables"]["product_variants"]["Row"][];
  upsellSuggestions?: ProductUpsellSuggestion[];
}

type ProductVariant = Database["public"]["Tables"]["product_variants"]["Row"];

// ─── Gallery ─────────────────────────────────────────────────────────────────

const fadeVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

function Gallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const count = images.length;
  const multiple = count > 1;

  function goTo(index: number) {
    if (index === active) return;
    setActive(index);
  }

  function navigate(dir: -1 | 1) {
    setActive((prev) => (prev + dir + count) % count);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 28) navigate(delta > 0 ? 1 : -1);
    touchStartX.current = null;
  }

  return (
    <div className="flex flex-col gap-3 -mx-4 sm:-mx-6 lg:mx-0">

      {/* ── Main image ── */}
      <div
        className={clsx(
          "group relative aspect-square w-full touch-pan-y overflow-hidden bg-white sm:bg-[var(--color-background)]",
          "sm:rounded-[var(--radius-lg)]"
        )}
        onTouchStart={multiple ? handleTouchStart : undefined}
        onTouchEnd={multiple ? handleTouchEnd : undefined}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {count > 0 ? (
            <motion.div
              key={active}
              variants={fadeVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              <Image
                src={images[active]}
                alt={`${name} — imagen ${active + 1}`}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-contain p-2 sm:p-0 sm:object-cover transition-transform duration-500 ease-out sm:group-hover:scale-[1.03]"
                priority
              />
            </motion.div>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ShoppingBag
                className="h-16 w-16 text-[var(--color-border)]"
                strokeWidth={1}
              />
            </div>
          )}
        </AnimatePresence>

        {/* ── Arrows — hidden on mobile until hover; always visible mobile ── */}
        {multiple && (
          <>
            <button
              onClick={() => navigate(-1)}
              aria-label="Imagen anterior"
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-zinc-900 shadow-sm backdrop-blur-sm transition-all active:bg-white lg:opacity-0 lg:group-hover:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate(1)}
              aria-label="Imagen siguiente"
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-zinc-900 shadow-sm backdrop-blur-sm transition-all active:bg-white lg:opacity-0 lg:group-hover:opacity-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Counter pill — mobile only */}
            <div className="lg:hidden absolute bottom-3 right-3 z-10 rounded-full bg-black/50 px-2.5 py-0.5 text-[11px] font-medium text-white">
              {active + 1} / {count}
            </div>
          </>
        )}
      </div>

      {/* ── Thumbnails — max 5 visible, scroll if more ── */}
      {multiple && (
        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 sm:px-6 lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Ver imagen ${i + 1}`}
              aria-current={active === i ? "true" : undefined}
              className={clsx(
                "relative h-16 w-16 shrink-0 snap-start overflow-hidden rounded-[var(--radius-sm)] border-2 transition-all duration-150",
                active === i
                  ? "border-zinc-900 opacity-100"
                  : "border-transparent opacity-50 hover:opacity-80 hover:border-zinc-300"
              )}
            >
              <Image
                src={src}
                alt={`${name} miniatura ${i + 1}`}
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stars ───────────────────────────────────────────────────────────────────

function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const dim = size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={clsx(
            dim,
            i <= rating ? "fill-amber-400 text-amber-400" : "fill-zinc-200 text-zinc-200"
          )}
        />
      ))}
    </div>
  );
}

// ─── Review card ─────────────────────────────────────────────────────────────

function ReviewCard({ review, featured = false }: { review: Review; featured?: boolean }) {
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
            <span className="text-sm font-semibold text-[var(--color-text)]">
              {review.author_name}
            </span>
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
          <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
            {review.comment}
          </p>
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

// ─── Main component ──────────────────────────────────────────────────────────

function variantLabel(optionValues: unknown): string {
  if (!optionValues || typeof optionValues !== "object") return "";
  return Object.values(optionValues as Record<string, string>)
    .filter(Boolean)
    .join(" / ");
}

export function ProductClient({ product, reviews, variants, upsellSuggestions = [] }: Props) {
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [qty, setQty] = useState(1);
  const mainCTARef = useRef<HTMLButtonElement>(null);
  const [addedSuggestionId, setAddedSuggestionId] = useState<string | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
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

  const add = useCartStore((s) => s.add);
  const openDrawer = useCartStore((s) => s.openDrawer);
  const cartItems = useCartStore((s) => s.items);

  const activeVariants = variants.filter((v) => v.active);
  const hasRealVariants = !!product.has_variants && activeVariants.length > 0;
  const defaultVariant = hasRealVariants ? activeVariants[0] : null;
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    defaultVariant?.id ?? null
  );
  const selectedRealVariant: ProductVariant | null = hasRealVariants
    ? activeVariants.find((v) => v.id === selectedVariantId) ?? defaultVariant
    : null;

  const displayPrice = selectedRealVariant?.price ?? product.price;
  const displayCompareAt =
    selectedRealVariant?.compare_at_price ?? product.compare_at_price;
  const displayStock = selectedRealVariant?.stock ?? product.stock;
  const displayImage =
    selectedRealVariant?.image_url || product.images?.[0] || "";

  const hasOffer =
    !!displayCompareAt && displayCompareAt > displayPrice;
  const discount = hasOffer
    ? Math.round((1 - displayPrice / displayCompareAt!) * 100)
    : 0;
  const savedAmount = hasOffer ? displayCompareAt! - displayPrice : 0;

  const variantGroups = product.variants
    ? (product.variants as Record<string, string[]>)
    : null;

  const selectedLegacyVariantLabel =
    Object.entries(selectedVariants)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" / ") || undefined;

  const selectedRealVariantLabel = selectedRealVariant
    ? variantLabel(selectedRealVariant.option_values)
    : undefined;

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
      : null;
  const featuredReview = useMemo(
    () =>
      [...reviews]
        .filter((r) => r.rating >= 4)
        .sort((a, b) => {
          if (b.rating !== a.rating) return b.rating - a.rating;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })[0] ?? null,
    [reviews]
  );
  const regularReviews = useMemo(
    () => reviews.filter((r) => r.id !== featuredReview?.id),
    [reviews, featuredReview]
  );

  const hasDescription = !!product.description?.trim();
  const hasModularSections = hasVisibleProductSections(product.product_sections);
  const urgencyMessage =
    displayStock < 10
      ? "🔥 Quedan pocas unidades"
      : displayStock <= 30
        ? "⚡ Alta demanda hoy"
        : null;
  const whyBuyCards = [
    {
      title: "Descuentos automáticos",
      description: "Al agregar más productos se activan beneficios en tu carrito.",
    },
    {
      title: "Compra asistida por WhatsApp",
      description: "Te ayudamos rápido con dudas, stock y coordinación del pedido.",
    },
    {
      title: "Selección pensada para mascotas",
      description: "Catálogo curado con foco en calidad, utilidad y confianza.",
    },
    {
      title: "Envío gratis por monto mínimo",
      description: "Desbloquea despacho sin costo cuando alcanzas el umbral.",
    },
  ];
  const cartProductIds = useMemo(
    () => new Set(cartItems.map((i) => i.product_id)),
    [cartItems]
  );
  const visibleUpsells = useMemo(
    () => upsellSuggestions.filter((s) => !cartProductIds.has(s.id)).slice(0, 6),
    [upsellSuggestions, cartProductIds]
  );

  const variantSelectionKey = hasRealVariants
    ? (selectedVariantId ?? "")
    : JSON.stringify(selectedVariants);

  useEffect(() => {
    setQty(1);
  }, [displayPrice, variantSelectionKey]);

  useEffect(() => {
    pixelEvents.viewContent(product);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  useEffect(() => {
    return () => {
      if (ratingAdvanceTimerRef.current) {
        window.clearTimeout(ratingAdvanceTimerRef.current);
      }
    };
  }, []);

  async function handleAdd() {
    if (adding || displayStock === 0) return;
    if (hasRealVariants && !selectedRealVariant?.id) {
      toast.error("Selecciona una variante válida antes de agregar al carrito.");
      return;
    }
    setAdding(true);
    try {
      const ok = add({
        product_id: product.id,
        has_variants: hasRealVariants,
        product_slug: product.slug,
        variant_id: hasRealVariants ? selectedRealVariant!.id : undefined,
        name: product.name,
        price: displayPrice,
        quantity: qty,
        image: displayImage,
        variant: selectedRealVariantLabel ?? selectedLegacyVariantLabel,
        option_values:
          (selectedRealVariant?.option_values as Record<string, string> | undefined) ??
          undefined,
        unitListPrice: displayPrice,
        discount_enabled: product.discount_enabled,
        discount_max_percent: product.discount_max_percent,
        discount_steps: product.discount_steps,
        discount_label: product.discount_label,
      });
      if (!ok) {
        toast.error("No se pudo agregar: falta elegir variante. Vuelve a seleccionarla en la ficha.");
        return;
      }
      pixelEvents.addToCart(product, qty);
      openDrawer();
    } finally {
      setAdding(false);
    }
  }

  function handleAddSuggestion(s: ProductUpsellSuggestion) {
    // Línea de upsell: precio fijo con `applied_discount_percent`. No usa discount_steps.
    const offerPrice = s.offerPrice > 0 ? s.offerPrice : s.price;
    const pct = s.discountPercent > 0 ? s.discountPercent : 0;
    add({
      product_id: s.id,
      has_variants: false,
      product_slug: s.slug,
      name: s.name,
      price: offerPrice,
      quantity: 1,
      image: s.image,
      source: "upsell",
      applied_discount_percent: pct,
      expected_unit_price: offerPrice,
      unitListPrice: s.price,
      discount_enabled: s.discount_enabled === true,
      discount_max_percent:
        typeof s.discount_max_percent === "number" && Number.isFinite(s.discount_max_percent)
          ? s.discount_max_percent
          : undefined,
      isUpsellOffer: true,
      originalPrice: s.price,
      discountPercent: pct,
    });
    setAddedSuggestionId(s.id);
    window.setTimeout(() => setAddedSuggestionId((prev) => (prev === s.id ? null : prev)), 1200);
  }

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
          product_id: product.id,
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
      setReviewForm({
        rating: 0,
        author_name: "",
        author_email: "",
        comment: "",
        photo_url: "",
      });
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
    <main className="mx-auto max-w-7xl py-8 pb-28 md:pb-8">

      {/* ── Product grid: gallery left, info right ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-16 lg:px-8">

        {/* Gallery — full bleed on mobile, half column on desktop */}
        <Gallery images={product.images ?? []} name={product.name} />

        {/* Info panel — padded on mobile, flush on desktop */}
        <div className="mt-6 flex flex-col gap-5 px-4 sm:px-6 lg:mt-0 lg:px-0">
          <style jsx global>{`
            @keyframes upsell-pulse-soft {
              0% {
                transform: scale(1);
                box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
              }
              50% {
                transform: scale(1.05);
                box-shadow: 0 7px 16px rgba(250, 204, 21, 0.35);
              }
              100% {
                transform: scale(1);
                box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
              }
            }
          `}</style>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {normalizeProductCategory(product.category) && (
              <Badge variant="default">{normalizeProductCategory(product.category)}</Badge>
            )}
            {hasOffer && <Badge variant="danger">−{discount}%</Badge>}
            {displayStock > 0 && displayStock <= 5 && (
              <Badge variant="warning">¡Solo {displayStock} disponibles!</Badge>
            )}
            {displayStock === 0 && <Badge variant="danger">Agotado</Badge>}
          </div>

          {/* Name */}
          <h1
            className="product-title text-3xl font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-4xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {product.name}
          </h1>

          {/* Rating summary */}
          {avgRating !== null && (
            <div className="flex items-center gap-2">
              <Stars rating={avgRating} size="md" />
              <span className="text-sm text-[var(--color-text-muted)]">
                {reviews.length} {reviews.length === 1 ? "reseña" : "reseñas"}
              </span>
            </div>
          )}

          {/* Prices */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-3xl font-bold tabular-nums text-[var(--color-text)]">
                  {formatPrice(displayPrice)}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {qty === 1 ? "1 unidad" : `${qty} unidades`} ·{" "}
                  {formatPrice(displayPrice)} c/u
                </span>
              </div>
              {hasOffer && (
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-lg text-[var(--color-text-muted)] line-through tabular-nums">
                    {formatPrice(displayCompareAt!)}
                  </span>
                  <span className="text-xs font-semibold text-emerald-700">
                    Ahorras {formatPrice(savedAmount)} vs referencia ({discount}%)
                  </span>
                </div>
              )}
            </div>
          </div>
          {/* Variants */}
          {hasRealVariants ? (
            <div id="pdp-variants" className="flex flex-col gap-2 scroll-mt-24 rounded-[var(--radius-md)] transition-shadow duration-300">
              <span className="text-sm font-semibold text-[var(--color-text)]">Cantidad:</span>
              <div className="flex flex-wrap gap-2">
                {activeVariants.map((variant) => {
                  const value = variantLabel(variant.option_values) || variant.title;
                  const disabled = variant.stock <= 0;
                  const selected = selectedRealVariant?.id === variant.id;
                  return (
                    <button
                      key={variant.id}
                      onClick={() => !disabled && setSelectedVariantId(variant.id)}
                      disabled={disabled}
                      className={clsx(
                        "rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm font-medium transition-colors",
                        selected
                          ? "border-transparent [background:var(--brand-gradient)] text-white"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-primary)]",
                        disabled && "cursor-not-allowed opacity-45"
                      )}
                    >
                      {value}
                      {variant.badge_text ? ` ${variant.badge_text}` : ""}
                      {disabled ? " · Agotado" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : variantGroups ? (
            <div id="pdp-variants" className="flex flex-col gap-4 scroll-mt-24 rounded-[var(--radius-md)] transition-shadow duration-300">
              {Object.entries(variantGroups).map(([group, options]) => (
                <div key={group} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--color-text)]">
                      {group}:
                    </span>
                    {selectedVariants[group] && (
                      <span className="text-sm text-[var(--color-text-muted)]">
                        {selectedVariants[group]}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {options.map((opt) => {
                      const selected = selectedVariants[group] === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() =>
                            setSelectedVariants((prev) => ({ ...prev, [group]: opt }))
                          }
                          className={clsx(
                            "rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm font-medium transition-colors",
                            selected
                              ? "border-transparent [background:var(--brand-gradient)] text-white"
                              : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-primary)]"
                          )}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Cantidad (afecta precio por volumen y tabla de escalones) */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-[var(--color-text)]">Unidades</span>
            <div className="flex items-center gap-0.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-0.5">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Reducir cantidad"
                className="flex h-8 w-8 items-center justify-center rounded text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-border)]/40 hover:text-[var(--color-text)] disabled:opacity-35"
                disabled={displayStock === 0 || qty <= 1}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-[2.25rem] text-center text-sm font-semibold tabular-nums text-[var(--color-text)]">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(displayStock, q + 1))}
                aria-label="Aumentar cantidad"
                className="flex h-8 w-8 items-center justify-center rounded text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-border)]/40 hover:text-[var(--color-text)] disabled:opacity-35"
                disabled={displayStock === 0 || qty >= displayStock}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Main CTA */}
          <Button
            ref={mainCTARef}
            size="lg"
            fullWidth
            loading={adding}
            disabled={displayStock === 0}
            onClick={handleAdd}
            className="mt-1"
          >
            {displayStock === 0 ? "Agotado" : "Agregar al carrito"}
          </Button>
          {urgencyMessage && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className={clsx(
                "mt-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium",
                displayStock < 10
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-orange-200 bg-orange-50 text-orange-700"
              )}
            >
              {urgencyMessage}
            </motion.div>
          )}

          {/* Trust badges */}
          <TrustBadges />

          {visibleUpsells.length > 0 && (
            <section className="rounded-[var(--radius-lg)] border border-[var(--color-primary)]/25 bg-zinc-50 px-3.5 py-3">
              <p className="text-sm font-semibold text-zinc-900">
                También te puede interesar
              </p>

              <div className="mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {visibleUpsells.map((s) => (
                  <div
                    key={s.id}
                    className="w-[44%] min-w-[44%] snap-start rounded-[var(--radius-md)] border border-zinc-200 bg-white p-2.5 shadow-sm sm:w-[200px] sm:min-w-[200px] lg:w-[220px] lg:min-w-[220px]"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="relative h-20 w-full overflow-hidden rounded-[var(--radius-sm)] bg-zinc-100">
                        {s.image ? (
                          <Image
                            src={s.image}
                            alt={s.name}
                            fill
                            sizes="220px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-zinc-400">
                            <ShoppingBag className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-xs font-semibold leading-snug text-zinc-900">
                          {s.name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {s.price > s.offerPrice && (
                            <span className="text-[10px] text-zinc-500 line-through">
                              {formatPrice(s.price)}
                            </span>
                          )}
                          <span className="text-xs font-extrabold text-zinc-900">
                            {formatPrice(s.offerPrice)}
                          </span>
                          {s.discountPercent > 0 && (
                            <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                              -{s.discountPercent}%
                            </span>
                          )}
                        </div>
                        {s.savings > 0 && (
                          <p className="mt-0.5 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                            Ahorras {formatPrice(s.savings)}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddSuggestion(s)}
                        className="inline-flex h-8 w-fit items-center justify-center rounded-full bg-yellow-400 px-3.5 text-[11px] font-bold text-black transition-all duration-200 hover:scale-[1.05] hover:bg-yellow-300 animate-[upsell-pulse-soft_2.2s_infinite_ease-in-out] hover:[animation-play-state:paused]"
                      >
                        {addedSuggestionId === s.id ? "Agregado" : "Agregar"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* ── Descripción / Bloques modulares ── */}
      {hasModularSections ? (
        <div className="mt-12 sm:mt-16">
          <ProductSectionsRenderer sections={product.product_sections} />
        </div>
      ) : hasDescription ? (
        <section className="mx-auto mt-20 max-w-2xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.42, ease: "easeOut" }}
            className="mb-7 rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50/70 px-4 py-4"
          >
            <p className="text-lg font-bold text-amber-900">😺 Haz feliz a tu gato hoy</p>
            <p className="mt-1 text-sm text-amber-800">
              Menos olor, menos limpieza, más tranquilidad para ti.
            </p>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mb-8 font-display text-2xl font-bold text-[var(--color-text)] sm:text-3xl"
          >
            Sobre este producto
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="text-[var(--color-text-muted)] [&_a]:underline [&_a:hover]:opacity-70 [&_h1]:mb-3 [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-[var(--color-text)] [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[var(--color-text)] [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:font-semibold [&_h3]:text-[var(--color-text)] [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-4 [&_p]:text-base [&_p]:leading-relaxed [&_strong]:font-semibold [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: product.description! }}
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative mt-10 overflow-hidden rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-5 shadow-[0_14px_34px_rgba(0,0,0,0.06)] sm:p-6"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-brand-gradient"
            />
            <h3 className="font-display text-xl font-bold text-zinc-900 sm:text-2xl">
              ¿Por qué comprarlo aquí?
            </h3>
            <p className="mt-1 text-sm text-zinc-600">
              Diseñamos una experiencia de compra simple, confiable y pensada para tu mascota.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {whyBuyCards.map((item) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.34, ease: "easeOut" }}
                  whileHover={{ y: -3, scale: 1.01 }}
                  className="rounded-[var(--radius-md)] border border-zinc-200 bg-zinc-50 px-3.5 py-3.5 transition-colors hover:border-zinc-300"
                >
                  <p className="text-sm font-semibold text-zinc-900">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                    {item.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>
      ) : null}

      {/* ── Reviews ── */}
      <section className="mt-20 px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
                Reseñas
              </h2>
              {avgRating !== null && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-amber-500">
                    {"★".repeat(Math.round(avgRating))}
                    {"☆".repeat(5 - Math.round(avgRating))}
                  </span>
                  <span className="text-sm text-[var(--color-text-muted)]">
                    {avgRating.toFixed(1)} de 5 ({reviews.length} opiniones)
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setReviewModalOpen(true);
                setReviewSuccessMsg(null);
                setReviewErrorMsg(null);
                setShowPhotoInput(false);
                setReviewStep(1);
              }}
              className="inline-flex h-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-primary)]/35 hover:bg-[var(--color-background)]"
            >
              Escribir reseña
            </button>
          </div>

          {reviews.length > 0 ? (
            <div className="space-y-4">
              {featuredReview && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-amber-700">
                    Reseña destacada
                  </p>
                  <ReviewCard review={featuredReview} featured />
                </div>
              )}
              <div id="reviews-list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {regularReviews.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-6 text-sm text-[var(--color-text-muted)]">
              Aún no hay reseñas aprobadas para este producto.
            </div>
          )}
        </section>

      <section className="mt-10 px-4 sm:px-6 lg:px-8">
        <div className="rounded-[var(--radius-md)] border border-zinc-200 bg-zinc-50 px-4 py-4 sm:px-5">
          <div className="space-y-2.5 text-sm text-zinc-700">
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Garantía de satisfacción 10 días</span>
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Más de 1000 clientes felices</span>
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Respuesta rápida por WhatsApp</span>
            </p>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {reviewModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] hidden bg-black/45 backdrop-blur-[1px] md:block"
              onClick={() => setReviewModalOpen(false)}
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
                      onClick={() => setReviewModalOpen(false)}
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
                                animate={
                                  n === reviewForm.rating
                                    ? { scale: [1, 1.24, 1] }
                                    : { scale: 1 }
                                }
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
                            <span className="text-xs font-medium text-[var(--color-text)]">
                              URL de foto
                            </span>
                            <input
                              type="url"
                              value={reviewForm.photo_url}
                              onChange={(e) =>
                                setReviewForm((p) => ({ ...p, photo_url: e.target.value }))
                              }
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
                          onChange={(e) =>
                            setReviewForm((p) => ({ ...p, comment: e.target.value }))
                          }
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
                        <h4 className="font-display text-xl font-bold text-[var(--color-text)]">
                          Último paso
                        </h4>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-[var(--color-text)]">
                            Nombre completo
                          </span>
                          <input
                            required
                            value={reviewForm.author_name}
                            onChange={(e) =>
                              setReviewForm((p) => ({ ...p, author_name: e.target.value }))
                            }
                            className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/35"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-[var(--color-text)]">
                            Email (opcional)
                          </span>
                          <input
                            type="email"
                            value={reviewForm.author_email}
                            onChange={(e) =>
                              setReviewForm((p) => ({ ...p, author_email: e.target.value }))
                            }
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
                          <p className="mt-3 text-xs font-semibold text-emerald-700">
                            {reviewSuccessMsg}
                          </p>
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
                      <Button fullWidth onClick={() => setReviewModalOpen(false)}>
                        Cerrar
                      </Button>
                    )}
                    {reviewStep === 1 && (
                      <Button variant="secondary" fullWidth onClick={() => setReviewModalOpen(false)}>
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

      {/* ── Sticky CTA — mobile only ── */}
      <StickyAddToCart
        product={product}
        baseUnitPrice={displayPrice}
        compareAtPrice={displayCompareAt ?? null}
        stock={displayStock}
        image={displayImage}
        targetRef={mainCTARef}
        selectedVariant={selectedRealVariantLabel ?? selectedLegacyVariantLabel}
        selectedVariantId={selectedRealVariant?.id}
        selectedOptionValues={
          (selectedRealVariant?.option_values as Record<string, string> | undefined) ??
          undefined
        }
      />
    </main>
  );
}
