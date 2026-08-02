"use client";

import { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus, Minus, X, ShoppingBag, ArrowLeft } from "lucide-react";
import {
  useCartStore,
  cartItemToDiscountInput,
  cartItemNeedsVariantFix,
  type CartItem,
} from "@/lib/cart/store";
import { formatPrice } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import {
  getApplicableProductDiscount,
  getNextDiscountStep,
  isDiscountEnabled,
  normalizeDiscountSteps,
  formatDiscountTierMinQtyLabel,
  isLastDiscountTier,
} from "@/lib/discounts";
import { SHOW_VOLUME_DISCOUNTS } from "@/lib/config/features";

function CartVolumeHint({ item }: { item: CartItem }) {
  if (!SHOW_VOLUME_DISCOUNTS) return null;
  if (item.isUpsellOffer || item.source === "upsell") return null;
  const input = cartItemToDiscountInput(item);
  if (!isDiscountEnabled(input)) return null;
  const steps = normalizeDiscountSteps(item.discount_steps);
  if (steps.length === 0) return null;
  const pct = getApplicableProductDiscount(input, item.quantity);
  const next = getNextDiscountStep(input, item.quantity);
  const maxCap = Math.min(100, Math.max(0, Number(item.discount_max_percent) || 0));
  const nextIsLastTier = Boolean(next && isLastDiscountTier(steps, next.minQty));

  return (
    <div className="mt-1 space-y-0.5 text-[11px] leading-snug">
      {pct > 0 && (
        <p className="font-semibold text-emerald-700">{pct}% OFF por cantidad</p>
      )}
      {next && (
        <p className="text-[var(--color-text-muted)]">
          Agrega {Math.max(0, next.minQty - item.quantity)} más y desbloquea{" "}
          {Math.min(next.percent, maxCap)}% OFF
          {nextIsLastTier
            ? ` (${formatDiscountTierMinQtyLabel(next.minQty, { isLastTier: true })})`
            : ""}
        </p>
      )}
      {!next && pct > 0 && (
        <p className="font-medium text-emerald-800/90">
          Descuento máximo desbloqueado
        </p>
      )}
    </div>
  );
}

export default function CarritoPage() {
  const { items, remove, updateQuantity } = useCartStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const subtotal = useMemo(
    () => items.reduce((acc, i) => acc + i.price * i.quantity, 0),
    [items]
  );

  const totalItems = useMemo(
    () => items.reduce((acc, i) => acc + i.quantity, 0),
    [items]
  );

  const { totalSavings, savingsPercent } = useMemo(() => {
    let savings = 0;
    let totalOriginal = 0;
    for (const item of items) {
      const comparative = item.originalPrice;
      if (typeof comparative === "number" && comparative > item.price) {
        savings += (comparative - item.price) * item.quantity;
        totalOriginal += comparative * item.quantity;
      }
    }
    const percent =
      totalOriginal > 0 ? Math.round((savings / totalOriginal) * 100) : null;
    return { totalSavings: savings, savingsPercent: percent };
  }, [items]);

  const variantLineIssues = useMemo(
    () => items.filter(cartItemNeedsVariantFix),
    [items]
  );

  if (!mounted) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="h-6 w-40 animate-pulse rounded bg-[var(--color-border)]/50" />
        <div className="mt-4 h-8 w-64 animate-pulse rounded bg-[var(--color-border)]/50" />
        <div className="mt-8 space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl bg-[var(--color-border)]/30"
            />
          ))}
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col items-center justify-center px-4 py-24 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-background)]">
          <ShoppingBag
            className="h-10 w-10 text-[var(--color-text-muted)]"
            strokeWidth={1.5}
          />
        </div>
        <h1 className="mt-6 font-display text-2xl font-bold text-[var(--color-text)]">
          Tu carrito está vacío
        </h1>
        <p className="mt-2 text-[var(--color-text-muted)]">
          Agrega productos para comenzar tu compra.
        </p>
        <Link href="/productos" className="mt-6">
          <Button>Ver productos</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <Link
        href="/productos"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Seguir comprando
      </Link>

      <h1 className="mt-4 font-display text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
        Carrito de compras
      </h1>

      {variantLineIssues.length > 0 && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950"
        >
          <p className="font-semibold">Hay productos sin variante elegida</p>
          <p className="mt-1 text-amber-900/90">
            Elimina el producto y vuelve a agregarlo desde la ficha.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {variantLineIssues.map((item) => (
              <li
                key={`${item.product_id}-${item.variant ?? "x"}`}
                className="flex items-center gap-2"
              >
                <span className="font-medium">{item.name}</span>
                <Link
                  href={
                    item.product_slug
                      ? `/productos/${item.product_slug}`
                      : "/productos"
                  }
                  className="inline-flex rounded-md bg-amber-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-900"
                >
                  Corregir
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* ── Items ───────────────────────────────────────── */}
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={`${item.product_id}-${item.variant_id ?? item.variant ?? ""}`}
              className="flex gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-[var(--color-background)]">
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium leading-snug text-[var(--color-text)]">
                      {item.name}
                    </p>
                    {item.variant && (
                      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                        {item.variant}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-[var(--color-text)]">
                      <span className="font-semibold">
                        {formatPrice(item.price)}
                      </span>
                      <span className="text-[var(--color-text-muted)]"> c/u</span>
                    </p>
                    <CartVolumeHint item={item} />
                  </div>
                  <button
                    onClick={() =>
                      remove(item.product_id, {
                        variant: item.variant,
                        variant_id: item.variant_id,
                      })
                    }
                    aria-label={`Eliminar ${item.name}`}
                    className="shrink-0 p-1 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-error)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] p-0.5">
                    <button
                      onClick={() =>
                        updateQuantity(
                          item.product_id,
                          item.quantity - 1,
                          { variant: item.variant, variant_id: item.variant_id }
                        )
                      }
                      aria-label="Reducir cantidad"
                      disabled={item.quantity <= 1}
                      className="flex h-7 w-7 items-center justify-center rounded text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-border)]/40 hover:text-[var(--color-text)] disabled:opacity-40"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-7 text-center text-sm font-semibold text-[var(--color-text)]">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateQuantity(
                          item.product_id,
                          item.quantity + 1,
                          { variant: item.variant, variant_id: item.variant_id }
                        )
                      }
                      aria-label="Aumentar cantidad"
                      className="flex h-7 w-7 items-center justify-center rounded text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-border)]/40 hover:text-[var(--color-text)]"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  <p className="font-bold text-[var(--color-text)]">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* ── Order summary ────────────────────────────────── */}
        <aside className="h-fit space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-base font-semibold text-[var(--color-text)]">
            Resumen del pedido
          </h2>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-muted)]">
                Subtotal ({totalItems}{" "}
                {totalItems === 1 ? "producto" : "productos"})
              </span>
              <span className="font-semibold text-[var(--color-text)]">
                {formatPrice(subtotal)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-muted)]">Envío</span>
              <span className="text-[var(--color-text-muted)]">
                Se calcula al pagar
              </span>
            </div>
          </div>

          {totalSavings > 0 && (
            <p className="text-sm font-extrabold text-[#16a34a]">
              {savingsPercent && savingsPercent > 0
                ? `💸 Ahorraste ${formatPrice(totalSavings)} (${savingsPercent}%)`
                : `💸 Ahorraste ${formatPrice(totalSavings)}`}
            </p>
          )}

          <div className="border-t border-[var(--color-border)] pt-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--color-text)]">
                Total estimado
              </span>
              <span className="text-xl font-bold text-[var(--color-text)]">
                {formatPrice(subtotal)}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Incluye IVA · envío se añade al pagar
            </p>
          </div>

          <Link href="/checkout" className="block">
            <Button fullWidth size="lg">
              Finalizar compra
            </Button>
          </Link>
        </aside>
      </div>
    </main>
  );
}
