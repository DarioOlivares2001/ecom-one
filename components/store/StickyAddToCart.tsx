"use client";

import { useState, useEffect, type RefObject } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, ShoppingBag } from "lucide-react";

import { useCartStore } from "@/lib/cart/store";
import { pixelEvents } from "@/lib/pixel/events";
import { formatPrice } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import type { Product } from "@/lib/supabase/types";
import { productRequiresVariantChoice } from "@/lib/product/catalogVariants";
import { getDiscountedUnitPrice } from "@/lib/discounts";

interface StickyAddToCartProps {
  product: Product;
  /** Ref al CTA principal del hero; el sticky aparece cuando ese CTA sale del viewport. */
  targetRef: RefObject<HTMLElement>;
  /** Precio lista (variante o producto). Si se envía, el sticky aplica descuento por cantidad a 1u. */
  baseUnitPrice?: number;
  /** Alias retrocompatible de `baseUnitPrice`. */
  price?: number;
  /** Precio de referencia (compare_at_price) para mostrar tachado en el sticky. */
  compareAtPrice?: number | null;
  stock?: number;
  image?: string;
  selectedVariant?: string;
  selectedVariantId?: string;
  selectedOptionValues?: Record<string, string>;
  /**
   * Id del wrapper de selectores de variante en la PDP. Cuando el producto
   * requiere elegir variante y el usuario aún no eligió, el botón cambia a
   * "Elegir opciones" y hace scroll suave a este id.
   */
  variantsAnchorId?: string;
}

const DEFAULT_VARIANTS_ANCHOR = "pdp-variants";

export function StickyAddToCart({
  product,
  targetRef,
  baseUnitPrice,
  price,
  compareAtPrice,
  stock,
  image,
  selectedVariant,
  selectedVariantId,
  selectedOptionValues,
  variantsAnchorId = DEFAULT_VARIANTS_ANCHOR,
}: StickyAddToCartProps) {
  const [visible, setVisible] = useState(false);
  const [adding, setAdding] = useState(false);
  const add = useCartStore((s) => s.add);
  const openDrawer = useCartStore((s) => s.openDrawer);

  const listUnit = baseUnitPrice ?? price ?? product.price;
  const volumeInput = {
    price: listUnit,
    discount_enabled: product.discount_enabled,
    discount_max_percent: product.discount_max_percent,
    discount_steps: product.discount_steps,
    discount_label: product.discount_label,
  };
  const displayUnit = getDiscountedUnitPrice(volumeInput, 1, listUnit);
  const effectiveStock = stock ?? product.stock;
  const effectiveImage = image ?? product.images?.[0] ?? "";

  // Referencia ("antes") = el mayor entre compare_at_price del lado seleccionado
  // y el listUnit; sirve sólo para el tachado visual.
  const referencePrice =
    compareAtPrice && compareAtPrice > displayUnit ? compareAtPrice : null;
  const offerPercent = referencePrice
    ? Math.round(((referencePrice - displayUnit) / referencePrice) * 100)
    : 0;

  const requiresVariantChoice = productRequiresVariantChoice(product);
  const needsVariantPick = requiresVariantChoice && !selectedVariantId?.trim();
  const outOfStock = effectiveStock === 0;

  // Mostrar la barra cuando el CTA principal sale de viewport
  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [targetRef]);

  function scrollToVariants() {
    if (typeof document === "undefined") return;
    const el = document.getElementById(variantsAnchorId);
    if (!el) {
      // Fallback: scroll al CTA principal si existe
      targetRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Pequeño "pulso" via clase efímera para llamar la atención
    el.classList.add("ring-2", "ring-[var(--color-primary)]", "ring-offset-2");
    window.setTimeout(() => {
      el.classList.remove("ring-2", "ring-[var(--color-primary)]", "ring-offset-2");
    }, 1400);
  }

  async function handleAdd() {
    if (adding || outOfStock) return;
    if (needsVariantPick) {
      scrollToVariants();
      return;
    }

    setAdding(true);
    try {
      const ok = add({
        product_id: product.id,
        has_variants: requiresVariantChoice,
        product_slug: product.slug,
        variant_id: selectedVariantId,
        name: product.name,
        price: listUnit,
        quantity: 1,
        image: effectiveImage,
        variant: selectedVariant,
        option_values: selectedOptionValues,
        unitListPrice: listUnit,
        discount_enabled: product.discount_enabled,
        discount_max_percent: product.discount_max_percent,
        discount_steps: product.discount_steps,
        discount_label: product.discount_label,
      });
      if (!ok) {
        toast.error("Selecciona una variante en la ficha antes de agregar.");
        return;
      }
      pixelEvents.addToCart(product, 1);
      openDrawer();
    } finally {
      setAdding(false);
    }
  }

  const ctaLabel = outOfStock
    ? "Agotado"
    : needsVariantPick
      ? "Elegir opciones"
      : "Agregar al carrito";

  return (
    // md:hidden — solo mobile; el wrapper queda para que AnimatePresence funcione
    <div className="md:hidden" aria-hidden={!visible}>
      <AnimatePresence>
        {visible && (
          <motion.div
            key="sticky-cart"
            initial={{ y: 96, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 34, mass: 0.9 }}
            className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-200/90 bg-white/95 px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl"
            role="region"
            aria-label="Agregar producto rápido"
          >
            <div className="flex items-center gap-3">
              {/* Miniatura */}
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-zinc-200 bg-zinc-50">
                {effectiveImage ? (
                  <Image
                    src={effectiveImage}
                    alt={product.name}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-zinc-300">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                )}
                {offerPercent > 0 && !needsVariantPick && (
                  <span className="pointer-events-none absolute -left-1 -top-1 inline-flex h-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-extrabold leading-none text-white shadow-sm">
                    -{offerPercent}%
                  </span>
                )}
              </div>

              {/* Nombre + precios */}
              <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <p className="truncate text-[11px] font-medium text-zinc-500">
                  {selectedVariant
                    ? `${product.name} · ${selectedVariant}`
                    : product.name}
                </p>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-base font-extrabold tabular-nums text-zinc-900">
                    {formatPrice(displayUnit)}
                  </span>
                  {referencePrice && (
                    <span className="text-[11px] tabular-nums text-zinc-400 line-through">
                      {formatPrice(referencePrice)}
                    </span>
                  )}
                </div>
              </div>

              {/* CTA */}
              <Button
                onClick={handleAdd}
                loading={adding}
                disabled={outOfStock}
                variant={needsVariantPick ? "secondary" : "primary"}
                size="md"
                className="shrink-0 min-w-[136px] gap-1.5"
              >
                {needsVariantPick && !outOfStock && (
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                )}
                {ctaLabel}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
