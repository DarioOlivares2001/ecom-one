import { clsx } from "clsx";
import type { Json } from "@/lib/supabase/types";
import { formatPrice } from "@/lib/utils/format";
import {
  getDiscountedUnitPrice,
  isDiscountEnabled,
  normalizeDiscountSteps,
  formatDiscountTierMinQtyLabel,
  type ProductDiscountInput,
} from "@/lib/discounts";

type ProductTieredDiscountProps = {
  unitPrice: number;
  /** Cantidad elegida; al subir, resalta los niveles ya alcanzados. */
  quantity?: number;
  /** Tarjeta de grid: tipografía más compacta. */
  compact?: boolean;
  discount_enabled?: boolean;
  discount_max_percent?: number;
  discount_steps?: Json;
  discount_label?: string | null;
};

function inputFromProps(p: ProductTieredDiscountProps): ProductDiscountInput {
  return {
    price: p.unitPrice,
    discount_enabled: p.discount_enabled,
    discount_max_percent: p.discount_max_percent,
    discount_steps: p.discount_steps,
    discount_label: p.discount_label,
  };
}

/**
 * Bloque informativo: descuentos por cantidad desde `products` o (si no hay) nada.
 */
export function ProductTieredDiscount({
  unitPrice,
  quantity = 1,
  compact = false,
  discount_enabled,
  discount_max_percent,
  discount_steps,
  discount_label,
}: ProductTieredDiscountProps) {
  const input = inputFromProps({
    unitPrice,
    quantity,
    compact,
    discount_enabled,
    discount_max_percent,
    discount_steps,
    discount_label,
  });

  if (!isDiscountEnabled(input)) return null;

  const steps = normalizeDiscountSteps(discount_steps);
  if (steps.length === 0) return null;

  const safePrice = Math.max(0, Number.isFinite(unitPrice) ? unitPrice : 0);
  const maxP = Math.min(100, Math.max(0, Number(discount_max_percent) || 0));
  const qty = Math.max(1, Math.floor(quantity) || 1);

  return (
    <div
      className={clsx(
        "rounded-[var(--radius-md)] border border-[var(--color-border)]/70 bg-[var(--color-background)]",
        compact ? "px-2 py-1.5" : "px-3 py-2.5"
      )}
    >
      {discount_label ? (
        <p
          className={clsx(
            "font-medium leading-snug text-[var(--color-text-muted)]",
            compact ? "text-[10px]" : "text-xs"
          )}
        >
          {discount_label}
        </p>
      ) : (
        <p
          className={clsx(
            "font-medium leading-snug text-[var(--color-text-muted)]",
            compact ? "text-[10px]" : "text-xs"
          )}
        >
          💸 Mientras más llevas, menos pagas
        </p>
      )}
      <ul
        className={clsx(
          "mt-1.5 space-y-1",
          compact ? "text-[10px] leading-tight" : "text-xs leading-snug"
        )}
      >
        {steps.map((tier, tierIndex) => {
          const capped = Math.min(tier.percent, maxP);
          const reached = qty >= tier.minQty;
          const refUnit = getDiscountedUnitPrice(input, Math.max(tier.minQty, 1), safePrice);
          const isLastTier = tierIndex === steps.length - 1;
          return (
            <li
              key={tier.minQty}
              className={clsx(
                "rounded-[var(--radius-sm)] px-1.5 py-0.5 transition-all duration-200 ease-out",
                reached
                  ? "bg-[var(--color-primary)]/10 text-[var(--color-text)] ring-1 ring-[var(--color-primary)]/30"
                  : "text-[var(--color-text-muted)]"
              )}
            >
              <span className="font-medium tabular-nums">
                {formatDiscountTierMinQtyLabel(tier.minQty, { isLastTier: isLastTier, compact })}
              </span>
              <span className="mx-0.5 text-[var(--color-text-muted)]">→</span>
              <span className="font-semibold text-[var(--color-primary)]">{capped}% OFF</span>
              {!compact && (
                <span className="ml-1 text-[var(--color-text-muted)]">
                  · ~{formatPrice(refUnit)} c/u
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
