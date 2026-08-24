"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ShoppingBag, Star } from "lucide-react";
import { clsx } from "clsx";
import type { Product } from "@/lib/db/types";
import type { ResolvedPackTier } from "@/lib/product/sections/quantityPacks";
import { formatPrice } from "@/lib/utils/format";
import { isAllowedImageSrc } from "@/lib/images/isAllowedImageSrc";

interface PackSelectorProps {
  product: Product;
  tiers: ResolvedPackTier[];
  qty: number;
  setQty: (updater: (q: number) => number) => void;
}

const MAX_STACK_IMAGES = 3;

/**
 * Repite la imagen real de portada según la cantidad del pack (tope visual
 * de 3 copias superpuestas). Para packs con más de 3 unidades, la última
 * miniatura se reemplaza por un badge "×N" en vez de seguir apilando
 * imágenes. Fallback a un ícono limpio si la imagen falla o no hay ninguna.
 */
function PackImageStack({ src, count }: { src: string; count: number }) {
  const [broken, setBroken] = useState(false);
  const showImage = !!src && !broken;
  const overflow = count > MAX_STACK_IMAGES;
  const stackCount = Math.max(1, Math.min(count, MAX_STACK_IMAGES));

  return (
    <div className="flex shrink-0 items-center" aria-hidden>
      {Array.from({ length: stackCount }).map((_, i) => {
        const isLast = i === stackCount - 1;
        return (
          <div
            key={i}
            className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-[var(--color-surface)] bg-zinc-100"
            style={i === 0 ? { zIndex: 0 } : { marginLeft: -16, zIndex: i }}
          >
            {isLast && overflow ? (
              <div className="flex h-full w-full items-center justify-center bg-[var(--color-text)] text-[10px] font-extrabold text-[var(--color-surface)]">
                ×{count}
              </div>
            ) : showImage ? (
              <Image
                src={src}
                alt=""
                fill
                sizes="40px"
                className="object-cover"
                onError={() => setBroken(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-zinc-300">
                <ShoppingBag className="h-4 w-4" strokeWidth={1.5} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        selected ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"
      )}
    >
      {selected && <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]" />}
    </span>
  );
}

/**
 * Selector de packs, dentro del panel de compra (entre el stepper de
 * cantidad y el CTA principal). Selecciona el MISMO `qty` que ya comparten
 * PurchasePanel, StickyAddToCart, carrito y checkout — nunca crea un estado
 * ni un cálculo de precio propio; `tiers` ya viene resuelto desde
 * `resolvePackSelectorTiers` (mismas funciones de `lib/discounts.ts` que
 * usan carrito/checkout).
 *
 * Cada tarjeta es un `<input type="radio">` real (mismo `name`, navegación
 * con flechas nativa del navegador entre radios del mismo grupo) envuelto
 * en un `<label>` clickeable completo — no una imitación con ARIA.
 */
export function PackSelector({ product, tiers, qty, setQty }: PackSelectorProps) {
  const reduceMotion = useReducedMotion();
  const groupName = useId();
  const rawImage = product.images?.[0] ?? "";
  const image = isAllowedImageSrc(rawImage) ? rawImage : "";

  if (tiers.length === 0) return null;

  function selectTier(tier: ResolvedPackTier) {
    setQty(() => tier.minQty);
  }

  return (
    <fieldset className="flex flex-col gap-2.5 border-0 p-0 m-0">
      <legend className="mb-0.5 text-sm font-semibold text-[var(--color-text)]">Elige tu pack</legend>
      <div className="flex flex-col gap-2">
        {tiers.map((tier) => {
          const selected = qty === tier.minQty;
          const crossedOutPrice = tier.percent > 0 ? product.price * tier.minQty : null;
          const inputId = `${groupName}-${tier.minQty}`;

          return (
            <motion.label
              key={tier.minQty}
              htmlFor={inputId}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              className={clsx(
                "relative flex w-full cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border-2 px-3.5 py-3 text-left transition-colors [&:has(:focus-visible)]:ring-2 [&:has(:focus-visible)]:ring-[var(--color-primary)] [&:has(:focus-visible)]:ring-offset-2",
                selected
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/[0.06]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/40"
              )}
            >
              <input
                type="radio"
                id={inputId}
                name={groupName}
                value={tier.minQty}
                checked={selected}
                onChange={() => selectTier(tier)}
                className="sr-only"
              />

              <PackImageStack src={image} count={tier.minQty} />

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold text-[var(--color-text)]">
                    {tier.minQty === 1 ? "1 unidad" : `Pack x${tier.minQty}`}
                  </span>
                  {tier.isMostChosen && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950">
                      <Star className="h-2.5 w-2.5 fill-amber-950" />
                      Más elegido
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-base font-extrabold tabular-nums text-[var(--color-text)]">
                    {formatPrice(tier.totalPrice)}
                  </span>
                  {crossedOutPrice !== null && (
                    <span className="text-xs tabular-nums text-[var(--color-text-muted)] line-through">
                      {formatPrice(crossedOutPrice)}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {tier.minQty > 1 && (
                    <span className="text-[var(--color-text-muted)]">
                      {formatPrice(tier.unitPrice)} c/u
                    </span>
                  )}
                  {tier.savingsTotal > 0 && (
                    <span className="font-semibold text-emerald-700">
                      Ahorras {formatPrice(tier.savingsTotal)}
                    </span>
                  )}
                </div>
              </div>

              <RadioDot selected={selected} />
            </motion.label>
          );
        })}
      </div>
    </fieldset>
  );
}
