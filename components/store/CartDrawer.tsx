"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { X, Plus, Minus, ShoppingBag, MessageCircle, ArrowLeft } from "lucide-react";
import { useCartStore, cartItemToDiscountInput, cartItemNeedsVariantFix, type CartItem } from "@/lib/cart/store";
import { formatPrice } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import {
  buildWhatsAppOrderMessage,
  buildWhatsAppCartUrl,
  normalizeWhatsAppDigits,
} from "@/lib/cart/whatsappCartOrder";
import {
  getApplicableProductDiscount,
  getNextDiscountStep,
  isDiscountEnabled,
  normalizeDiscountSteps,
  formatDiscountTierMinQtyLabel,
  isLastDiscountTier,
} from "@/lib/discounts";
import { SHOW_CART_UPSELLS, SHOW_VOLUME_DISCOUNTS } from "@/lib/config/features";

type UpsellOffer = {
  id: string;
  name: string;
  image: string;
  /** Precio lista (tienda). */
  price: number;
  compare_at_price?: number | null;
  offerPrice: number;
  discountPercent: number;
  savings: number;
  stock: number;
  discount_enabled?: boolean;
  discount_max_percent?: number | null;
  /** Escalones de descuento por cantidad del producto (para aplicar en carrito). */
  discount_steps?: unknown;
};

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
      {pct > 0 ? <p className="font-semibold text-emerald-700">{pct}% OFF por cantidad</p> : null}
      {next ? (
        <p className="text-[var(--color-text-muted)]">
          Agrega {Math.max(0, next.minQty - item.quantity)} más y desbloquea{" "}
          {Math.min(next.percent, maxCap)}% OFF
          {nextIsLastTier
            ? ` (${formatDiscountTierMinQtyLabel(next.minQty, { isLastTier: true })})`
            : ""}
        </p>
      ) : null}
      {!next && pct > 0 ? (
        <p className="font-medium text-emerald-800/90">
          Descuento máximo desbloqueado
          {steps.length > 0
            ? ` (${formatDiscountTierMinQtyLabel(steps[steps.length - 1].minQty, { isLastTier: true })})`
            : ""}
        </p>
      ) : null}
    </div>
  );
}

type CartDrawerProps = {
  enableWhatsappCheckout?: boolean;
  /** Número configurado (ej. 56912345678 o +56 9 …); se normaliza a dígitos. */
  whatsappPhone?: string;
};

export function CartDrawer({
  whatsappPhone = "",
  enableWhatsappCheckout = false,
}: CartDrawerProps) {
  const { isOpen, closeDrawer, items, remove, updateQuantity, add } =
    useCartStore();
  const subtotal = useMemo(
    () => items.reduce((acc, i) => acc + i.price * i.quantity, 0),
    [items]
  );
  const { totalSavings, savingsPercent } = useMemo(() => {
    let savings = 0;
    let totalOriginal = 0;
    for (const item of items) {
      const priceComparative = item.originalPrice;
      if (typeof priceComparative === "number" && priceComparative > item.price) {
        savings += (priceComparative - item.price) * item.quantity;
        totalOriginal += priceComparative * item.quantity;
      }
    }
    const percent = totalOriginal > 0 ? Math.round((savings / totalOriginal) * 100) : null;
    return { totalSavings: savings, savingsPercent: percent };
  }, [items]);

  const whatsappDigits = useMemo(
    () => normalizeWhatsAppDigits(whatsappPhone),
    [whatsappPhone]
  );

  const whatsappOrderUrl = useMemo(() => {
    if (!whatsappDigits || items.length === 0) return null;
    const msg = buildWhatsAppOrderMessage(items, subtotal);
    return buildWhatsAppCartUrl(whatsappDigits, msg);
  }, [whatsappDigits, items, subtotal]);

  const variantLineIssues = useMemo(() => items.filter(cartItemNeedsVariantFix), [items]);

  const [offers, setOffers] = useState<UpsellOffer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [offerExpiresAt, setOfferExpiresAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [mobileOffersExpanded, setMobileOffersExpanded] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setOfferExpiresAt(Date.now() + 10 * 60 * 1000);
    setNowMs(Date.now());
    setMobileOffersExpanded(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !offerExpiresAt) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isOpen, offerExpiresAt]);

  const remainingSeconds = useMemo(() => {
    if (!offerExpiresAt) return 10 * 60;
    return Math.max(0, Math.floor((offerExpiresAt - nowMs) / 1000));
  }, [offerExpiresAt, nowMs]);

  const isOfferExpired = remainingSeconds <= 0;
  const countdownLabel = useMemo(() => {
    const mm = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
    const ss = String(remainingSeconds % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [remainingSeconds]);

  /**
   * Visual de la oferta sin involucrar `compare_at_price`.
   * El % aplicado proviene del servidor (step alcanzado), acotado por
   * `discount_max_percent`. Si no hay descuento real, se devuelve precio lista.
   */
  const resolveOfferVisual = (offer: UpsellOffer) => {
    const list = Number.isFinite(offer.price) ? offer.price : 0;
    const offerPrice = Number.isFinite(offer.offerPrice) ? offer.offerPrice : list;
    const enabled = offer.discount_enabled === true;
    const cap = Math.min(
      100,
      Math.max(0, Number(offer.discount_max_percent) || 0)
    );
    const rawPct =
      typeof offer.discountPercent === "number" && offer.discountPercent > 0
        ? Math.round(offer.discountPercent)
        : 0;
    const discountPercent = enabled && cap > 0 ? Math.min(rawPct, cap) : 0;
    if (discountPercent <= 0 || offerPrice >= list) {
      return { originalPrice: list, offerPrice: list, savings: 0, discountPercent: 0 };
    }
    const savings = Math.max(0, Math.round(list - offerPrice));
    return { originalPrice: list, offerPrice, savings, discountPercent };
  };

  useEffect(() => {
    if (!SHOW_CART_UPSELLS || !isOpen || items.length === 0) {
      setOffers([]);
      setLoadingOffers(false);
      return;
    }

    const controller = new AbortController();
    const cartProductIds = Array.from(new Set(items.map((i) => i.product_id)));

    async function loadUpsells() {
      setLoadingOffers(true);
      try {
        const res = await fetch("/api/upsells", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cartProductIds,
            cartProductNames: items.map((i) => i.name).filter(Boolean),
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          setOffers([]);
          return;
        }
        const payload = (await res.json()) as { offers?: UpsellOffer[]; title?: string };
        // Filtro defensivo: solo se renderizan ofertas reales (regla 6).
        const safeOffers = (Array.isArray(payload.offers) ? payload.offers : []).filter(
          (o) =>
            o &&
            o.discount_enabled === true &&
            Number(o.discount_max_percent) > 0 &&
            Number(o.discountPercent) > 0 &&
            Number(o.offerPrice) > 0 &&
            Number(o.offerPrice) < Number(o.price)
        );
        setOffers(safeOffers);
      } catch {
        if (!controller.signal.aborted) {
          setOffers([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoadingOffers(false);
      }
    }

    loadUpsells();
    return () => controller.abort();
  }, [isOpen, items]);

  function addUpsell(offer: UpsellOffer) {
    // Línea de upsell: el % proviene del motor de upsells (UPSELL_BASE_PERCENT
    // acotado por `discount_max_percent`). NO se mezcla con discount_steps.
    add({
      product_id: offer.id,
      has_variants: false,
      name: offer.name,
      price: offer.offerPrice,
      quantity: 1,
      image: offer.image,
      source: "upsell",
      applied_discount_percent: offer.discountPercent,
      expected_unit_price: offer.offerPrice,
      unitListPrice: offer.price,
      discount_enabled: offer.discount_enabled === true,
      discount_max_percent:
        typeof offer.discount_max_percent === "number" && Number.isFinite(offer.discount_max_percent)
          ? offer.discount_max_percent
          : undefined,
      // No se pasan discount_steps: en línea de upsell no se usan.
      isUpsellOffer: true,
      originalPrice: offer.price,
      discountPercent: offer.discountPercent,
    });
    setOffers((prev) => prev.filter((o) => o.id !== offer.id));
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <style jsx global>{`
            @keyframes pulse-buy {
              0% {
                transform: scale(1);
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
              }
              50% {
                transform: scale(1.06);
                box-shadow: 0 8px 18px rgba(255, 193, 7, 0.45);
              }
              100% {
                transform: scale(1);
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
              }
            }
            @keyframes pulse-buy-mobile {
              0% {
                transform: scale(1);
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
              }
              50% {
                transform: scale(1.04);
                box-shadow: 0 8px 16px rgba(255, 193, 7, 0.4);
              }
              100% {
                transform: scale(1);
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
              }
            }
            @keyframes pulse-buy-strong {
              0% {
                transform: scale(1);
                box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.65);
              }
              45% {
                transform: scale(1.11);
                box-shadow: 0 0 0 10px rgba(255, 193, 7, 0);
              }
              70% {
                transform: scale(1.04);
              }
              100% {
                transform: scale(1);
                box-shadow: 0 0 0 0 rgba(255, 193, 7, 0);
              }
            }
          `}</style>
          {/* Overlay */}
          <motion.div
            ref={overlayRef}
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, pointerEvents: "auto" }}
            exit={{ opacity: 0, pointerEvents: "none" }}
            transition={{ duration: 0.2 }}
            onClick={closeDrawer}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            aria-hidden
          />

          {/* Drawer panel */}
          <motion.aside
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0, pointerEvents: "auto" }}
            exit={{ x: "100%", pointerEvents: "none" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-[var(--color-surface)] shadow-[var(--shadow-lg)]"
            aria-label="Carrito de compras"
            role="dialog"
            aria-modal="true"
          >
            {SHOW_CART_UPSELLS && (loadingOffers || offers.length > 0) && (
              <aside className="absolute left-0 top-[74px] z-30 hidden w-[260px] -translate-x-[calc(100%+12px)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[0_20px_45px_rgba(0,0,0,0.28)] lg:block">
                <p className="text-sm font-semibold text-[var(--color-text)]">🎁 Ofertas para tu pedido</p>
                <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">Solo por este carrito</p>
                <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                  ⏳ Expira en <span className="font-semibold text-[var(--color-text)]">{countdownLabel}</span>
                </p>
                {loadingOffers ? (
                  <div className="mt-2.5 space-y-2">
                    <div className="h-16 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-border)]/35" />
                    <div className="h-16 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-border)]/25" />
                  </div>
                ) : (
                  <div className="mt-2.5 space-y-2.5">
                    {offers.slice(0, 2).map((offer) => {
                      const visual = resolveOfferVisual(offer);
                      return (
                        <div
                          key={offer.id}
                          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] p-2.5"
                        >
                        <div className="flex gap-2.5">
                          <div className="relative h-[54px] w-[54px] shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-surface)]">
                            {offer.image ? (
                              <Image
                                src={offer.image}
                                alt={offer.name}
                                fill
                                sizes="54px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[var(--color-text-muted)]">
                                <ShoppingBag className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-[var(--color-text)]">{offer.name}</p>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              {!isOfferExpired && visual.originalPrice > visual.offerPrice && (
                                <span className="text-[10px] text-[var(--color-text-muted)] line-through">
                                  {formatPrice(visual.originalPrice)}
                                </span>
                              )}
                              <span className="text-sm font-extrabold text-[var(--color-text)]">
                                {formatPrice(visual.offerPrice)}
                              </span>
                              {!isOfferExpired && visual.discountPercent > 0 && (
                                <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                                  -{visual.discountPercent}% OFF
                                </span>
                              )}
                            </div>
                            {!isOfferExpired && visual.savings > 0 && (
                              <p className="mt-0.5 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                                Ahorras {formatPrice(visual.savings)}
                              </p>
                            )}
                            <div className="mt-1.5">
                              <button
                                type="button"
                                onClick={() => addUpsell(offer)}
                                className={[
                                  "inline-flex h-8 items-center justify-center rounded-full bg-yellow-400 px-3.5 text-[11px] font-bold text-black",
                                  "transition-all duration-200 hover:bg-yellow-300 hover:scale-[1.13]",
                                  visual.discountPercent > 0 &&
                                    !isOfferExpired &&
                                    "animate-[pulse-buy-strong_1.4s_infinite_ease-out] hover:[animation-play-state:paused]",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              >
                                Agregar
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </aside>
            )}
            {/* Header */}
            <div className="border-b border-[var(--color-border)] px-5 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-[var(--color-text)]">
                  Carrito
                  {items.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-[var(--color-text-muted)]">
                      ({items.length} {items.length === 1 ? "producto" : "productos"})
                    </span>
                  )}
                </h2>
                <button
                  onClick={closeDrawer}
                  aria-label="Cerrar carrito"
                  className="rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/40 hover:text-[var(--color-text)] transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <Link
                href="/productos"
                onClick={closeDrawer}
                className="mt-1.5 inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                <ArrowLeft className="h-3 w-3" />
                Seguir comprando
              </Link>
            </div>

            {variantLineIssues.length > 0 ? (
              <div
                role="alert"
                className="border-b border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-950"
              >
                <p className="font-semibold">Hay productos sin variante elegida</p>
                <p className="mt-1 text-amber-900/90">
                  Elimina este producto y vuelve a agregarlo desde la ficha.
                </p>
                <ul className="mt-2 space-y-2">
                  {variantLineIssues.map((item) => (
                    <li
                      key={`${item.product_id}-${item.variant ?? "x"}`}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <span className="font-medium">{item.name}</span>
                      <Link
                        href={item.product_slug ? `/productos/${item.product_slug}` : "/productos"}
                        onClick={() => closeDrawer()}
                        className="inline-flex rounded-md bg-amber-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-900"
                      >
                        Corregir
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Content */}
            {items.length === 0 ? (
              <EmptyCart onClose={closeDrawer} />
            ) : (
              <>
                {/* Items list */}
                <ul className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                  {items.map((item) => (
                    <li
                      key={`${item.product_id}-${item.variant_id ?? item.variant ?? ""}`}
                      className="flex gap-4"
                    >
                      {/* Product image */}
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-background)]">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      </div>

                      {/* Info + controls */}
                      <div className="flex flex-1 flex-col justify-between min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[var(--color-text)]">
                              {item.name}
                            </p>
                            {item.variant && (
                              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                {item.variant}
                              </p>
                            )}
                            <p className="mt-0.5 text-xs text-[var(--color-text)]">
                              <span className="font-medium">{formatPrice(item.price)}</span>
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
                            className="shrink-0 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          {/* Quantity controls */}
                          <div className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-0.5">
                            <button
                              onClick={() =>
                                updateQuantity(item.product_id, item.quantity - 1, {
                                  variant: item.variant,
                                  variant_id: item.variant_id,
                                })
                              }
                              aria-label="Reducir cantidad"
                              className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/40 hover:text-[var(--color-text)] transition-colors disabled:opacity-40"
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center text-sm font-medium text-[var(--color-text)]">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateQuantity(item.product_id, item.quantity + 1, {
                                  variant: item.variant,
                                  variant_id: item.variant_id,
                                })
                              }
                              aria-label="Aumentar cantidad"
                              className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/40 hover:text-[var(--color-text)] transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Item total */}
                          <p className="text-sm font-semibold text-[var(--color-text)]">
                            {formatPrice(item.price * item.quantity)}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {SHOW_CART_UPSELLS && (loadingOffers || offers.length > 0) && (
                  <section className="border-t border-[var(--color-border)] px-5 py-3 lg:hidden">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-text)]">🎁 Ofertas para tu pedido</p>
                        <p className="text-[11px] text-[var(--color-text-muted)]">Solo por este carrito</p>
                      </div>
                      {offers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setMobileOffersExpanded((prev) => !prev)}
                          className="text-[11px] font-semibold text-[var(--color-primary)]"
                        >
                          {mobileOffersExpanded ? "Ver menos" : "Ver más ofertas"}
                        </button>
                      )}
                    </div>
                    <div className="mt-2 space-y-2.5">
                      {(mobileOffersExpanded ? offers.slice(0, 2) : offers.slice(0, 1)).map((offer) => {
                        const visual = resolveOfferVisual(offer);
                        return (
                          <div
                            key={offer.id}
                            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] p-2.5"
                          >
                          <div className="flex gap-2.5">
                            <div className="relative h-[54px] w-[54px] shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-surface)]">
                              {offer.image ? (
                                <Image
                                  src={offer.image}
                                  alt={offer.name}
                                  fill
                                  sizes="54px"
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[var(--color-text-muted)]">
                                  <ShoppingBag className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-[var(--color-text)]">{offer.name}</p>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                {!isOfferExpired && visual.originalPrice > visual.offerPrice && (
                                  <span className="text-[10px] text-[var(--color-text-muted)] line-through">
                                    {formatPrice(visual.originalPrice)}
                                  </span>
                                )}
                                <span className="text-sm font-extrabold text-[var(--color-text)]">
                                  {formatPrice(visual.offerPrice)}
                                </span>
                                {!isOfferExpired && visual.discountPercent > 0 && (
                                  <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                                    -{visual.discountPercent}% OFF
                                  </span>
                                )}
                              </div>
                              {!isOfferExpired && visual.savings > 0 && (
                                <p className="mt-0.5 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                                  Ahorras {formatPrice(visual.savings)}
                                </p>
                              )}
                              <div className="mt-1.5">
                                <button
                                  type="button"
                                  onClick={() => addUpsell(offer)}
                                  className={[
                                    "inline-flex h-8 items-center justify-center rounded-full bg-yellow-400 px-3.5 text-[11px] font-bold text-black",
                                    "transition-all duration-200 hover:bg-yellow-300 hover:scale-[1.13]",
                                    visual.discountPercent > 0 &&
                                      !isOfferExpired &&
                                      "animate-[pulse-buy-strong_1.4s_infinite_ease-out] hover:[animation-play-state:paused]",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                >
                                  Agregar
                                </button>
                              </div>
                            </div>
                          </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Footer */}
                <div className="border-t border-[var(--color-border)] px-5 py-5 space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-text-muted)]">Subtotal</span>
                    <span className="text-lg font-bold text-[var(--color-text)]">
                      {formatPrice(subtotal)}
                    </span>
                  </div>
                  {totalSavings > 0 && (
                    <p className="text-sm font-extrabold text-[#16a34a]">
                      {savingsPercent && savingsPercent > 0
                        ? `💸 Ahorraste ${formatPrice(totalSavings)} (${savingsPercent}% en total)`
                        : `💸 Ahorraste ${formatPrice(totalSavings)} en este pedido`}
                    </p>
                  )}
                  <div className="pt-1" />
                  <Link href="/checkout" onClick={closeDrawer}>
                    <Button fullWidth size="lg">
                      Finalizar compra
                    </Button>
                  </Link>

                  {enableWhatsappCheckout && whatsappOrderUrl && (
                    <div className="space-y-1.5">
                      <a
                        href={whatsappOrderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={closeDrawer}
                        className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[#1e9e51] bg-gradient-to-b from-[#2adf72] to-[#22c55e] px-4 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(34,197,94,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:from-[#30e779] hover:to-[#20bd59] hover:shadow-[0_14px_28px_rgba(34,197,94,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e]/45"
                      >
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/18 ring-1 ring-white/30">
                          <MessageCircle className="h-3.5 w-3.5" />
                        </span>
                        Pedir por WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-background)]">
        <ShoppingBag className="h-8 w-8 text-[var(--color-text-muted)]" strokeWidth={1.5} />
      </div>
      <div className="space-y-1.5">
        <p className="font-semibold text-[var(--color-text)]">Tu carrito está vacío</p>
        <p className="text-sm text-[var(--color-text-muted)]">
          Agrega productos para comenzar tu compra.
        </p>
      </div>
      <Link href="/productos" onClick={onClose}>
        <Button variant="secondary">Ver productos</Button>
      </Link>
    </div>
  );
}
