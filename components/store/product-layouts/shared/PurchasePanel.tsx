import { clsx } from "clsx";
import { Minus, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TrustBadges } from "@/components/store/TrustBadges";
import { ProductTieredDiscount } from "@/components/store/ProductTieredDiscount";
import { normalizeProductCategory } from "@/lib/product/categories";
import { formatPrice } from "@/lib/utils/format";
import { getActivePackLabel } from "@/lib/product/sections/quantityPacks";
import type { Product } from "@/lib/db/types";
import type { ProductCommercialState, ProductVariantState } from "../types";
import { Stars } from "./Stars";
import { variantLabel } from "./variantLabel";

interface PurchasePanelProps {
  product: Product;
  commercial: ProductCommercialState;
  variants: ProductVariantState;
  avgRating: number | null;
  reviewCount: number;
  /** Tipografía/espaciado más compactos — usado por el tema Técnico. */
  density?: "default" | "compact";
  /** Mensaje de urgencia (stock real, nunca inventado) — se puede ocultar para un tono más editorial. */
  showUrgency?: boolean;
  /** Bloque de descuento por cantidad (lib/discounts) — se muestra completo en el tema Oferta. */
  showTieredDiscount?: boolean;
}

export function PurchasePanel({
  product,
  commercial,
  variants,
  avgRating,
  reviewCount,
  density = "default",
  showUrgency = true,
  showTieredDiscount = false,
}: PurchasePanelProps) {
  const compact = density === "compact";
  const category = normalizeProductCategory(product.category);
  // Solo cambia el texto si el qty actual coincide con un pack real
  // configurado y activo — "Agregar al carrito" en cualquier otro caso.
  const activePackLabel = getActivePackLabel(product, commercial.qty);
  const ctaLabel =
    commercial.displayStock === 0
      ? "Agotado"
      : activePackLabel
        ? `Agregar ${activePackLabel} al carrito`
        : "Agregar al carrito";

  return (
    <div className={clsx("flex flex-col px-4 sm:px-6 lg:px-0", compact ? "gap-3.5" : "gap-5")}>
      {/* Badges */}
      <div className="flex flex-wrap items-center gap-2">
        {category && <Badge variant="default">{category}</Badge>}
        {commercial.hasOffer && <Badge variant="danger">−{commercial.discount}%</Badge>}
        {commercial.displayStock > 0 && commercial.displayStock <= 5 && (
          <Badge variant="warning">¡Solo {commercial.displayStock} disponibles!</Badge>
        )}
        {commercial.displayStock === 0 && <Badge variant="danger">Agotado</Badge>}
      </div>

      {/* Name */}
      <h1
        className={clsx(
          "product-title font-bold leading-tight tracking-tight text-[var(--color-text)]",
          compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"
        )}
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {product.name}
      </h1>

      {/* Rating summary */}
      {avgRating !== null && (
        <div className="flex items-center gap-2">
          <Stars rating={avgRating} size="md" />
          <span className="text-sm text-[var(--color-text-muted)]">
            {reviewCount} {reviewCount === 1 ? "reseña" : "reseñas"}
          </span>
        </div>
      )}

      {/* Prices */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-3xl font-bold tabular-nums text-[var(--color-text)]">
              {formatPrice(commercial.displayPrice)}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {commercial.qty === 1 ? "1 unidad" : `${commercial.qty} unidades`} ·{" "}
              {formatPrice(commercial.displayPrice)} c/u
            </span>
          </div>
          {commercial.hasOffer && (
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-lg text-[var(--color-text-muted)] line-through tabular-nums">
                {formatPrice(commercial.displayCompareAt!)}
              </span>
              <span className="text-xs font-semibold text-emerald-700">
                Ahorras {formatPrice(commercial.savedAmount)} vs referencia ({commercial.discount}%)
              </span>
            </div>
          )}
        </div>
      </div>

      {showTieredDiscount && (
        <ProductTieredDiscount
          unitPrice={commercial.displayPrice}
          quantity={commercial.qty}
          discount_enabled={product.discount_enabled}
          discount_max_percent={product.discount_max_percent}
          discount_steps={product.discount_steps}
          discount_label={product.discount_label}
        />
      )}

      {/* Variants */}
      {variants.hasRealVariants ? (
        <div
          id="pdp-variants"
          className="flex flex-col gap-2 scroll-mt-24 rounded-[var(--radius-md)] transition-shadow duration-300"
        >
          <span className="text-sm font-semibold text-[var(--color-text)]">Cantidad:</span>
          <div className="flex flex-wrap gap-2">
            {variants.activeVariants.map((variant) => {
              const value = variantLabel(variant.option_values) || variant.title;
              const disabled = variant.stock <= 0;
              const selected = variants.selectedRealVariant?.id === variant.id;
              return (
                <button
                  key={variant.id}
                  onClick={() => !disabled && variants.setSelectedVariantId(variant.id)}
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
      ) : variants.variantGroups ? (
        <div
          id="pdp-variants"
          className="flex flex-col gap-4 scroll-mt-24 rounded-[var(--radius-md)] transition-shadow duration-300"
        >
          {Object.entries(variants.variantGroups).map(([group, options]) => (
            <div key={group} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{group}:</span>
                {variants.selectedVariants[group] && (
                  <span className="text-sm text-[var(--color-text-muted)]">
                    {variants.selectedVariants[group]}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {options.map((opt) => {
                  const selected = variants.selectedVariants[group] === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() =>
                        variants.setSelectedVariants((prev) => ({ ...prev, [group]: opt }))
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
            onClick={() => commercial.setQty((q) => Math.max(1, q - 1))}
            aria-label="Reducir cantidad"
            className="flex h-8 w-8 items-center justify-center rounded text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-border)]/40 hover:text-[var(--color-text)] disabled:opacity-35"
            disabled={commercial.displayStock === 0 || commercial.qty <= 1}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-[2.25rem] text-center text-sm font-semibold tabular-nums text-[var(--color-text)]">
            {commercial.qty}
          </span>
          <button
            type="button"
            onClick={() => commercial.setQty((q) => Math.min(commercial.displayStock, q + 1))}
            aria-label="Aumentar cantidad"
            className="flex h-8 w-8 items-center justify-center rounded text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-border)]/40 hover:text-[var(--color-text)] disabled:opacity-35"
            disabled={commercial.displayStock === 0 || commercial.qty >= commercial.displayStock}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main CTA */}
      <Button
        ref={commercial.mainCTARef}
        size="lg"
        fullWidth
        loading={commercial.adding}
        disabled={commercial.displayStock === 0}
        onClick={commercial.handleAdd}
        className="mt-1"
      >
        {ctaLabel}
      </Button>
      {showUrgency && commercial.urgencyMessage && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className={clsx(
            "mt-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium",
            commercial.displayStock < 10
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-orange-200 bg-orange-50 text-orange-700"
          )}
        >
          {commercial.urgencyMessage}
        </motion.div>
      )}

      {/* Trust badges */}
      <TrustBadges />
    </div>
  );
}
