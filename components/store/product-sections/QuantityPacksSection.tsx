"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";
import { clsx } from "clsx";
import type { Product } from "@/lib/db/types";
import type { QuantityPacksData } from "@/lib/product/sections/types";
import { resolvePackTiers } from "@/lib/product/sections/quantityPacks";
import { formatPrice } from "@/lib/utils/format";
import { SectionContainer } from "./shared/SectionContainer";

interface QuantityPacksSectionProps {
  data: QuantityPacksData;
  product: Product;
  qty: number;
  setQty: (updater: (q: number) => number) => void;
}

/**
 * "Packs y ahorro": tarjetas seleccionables de los escalones REALES de
 * descuento por cantidad (nunca inventa precio ni porcentaje — ver
 * resolvePackTiers). Seleccionar una tarjeta solo cambia el `qty`
 * compartido del orquestador (ProductClient) — el mismo que ya usan el CTA
 * principal y el sticky add-to-cart, así que no hay estado ni carrito
 * paralelo: agregar al carrito sigue siendo responsabilidad exclusiva del
 * botón "Agregar".
 */
export function QuantityPacksSection({ data, product, qty, setQty }: QuantityPacksSectionProps) {
  const tiers = resolvePackTiers(product, data);
  const reduceMotion = useReducedMotion();

  if (tiers.length === 0) return null;

  return (
    <SectionContainer heading={data.heading}>
      {data.description && (
        <p className="mb-4 text-sm text-[var(--color-text-muted)]">{data.description}</p>
      )}
      <div className="flex flex-wrap gap-2.5">
        {tiers.map((tier) => {
          const selected = qty === tier.minQty;
          return (
            <motion.button
              key={tier.minQty}
              type="button"
              onClick={() => setQty(() => tier.minQty)}
              aria-pressed={selected}
              whileTap={reduceMotion ? undefined : { scale: 0.96 }}
              animate={reduceMotion ? undefined : { scale: selected ? 1.02 : 1 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className={clsx(
                "relative flex min-w-[112px] flex-col items-center gap-1 rounded-[var(--radius-md)] border-2 px-4 py-3 text-center transition-colors",
                selected
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/[0.06]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/40"
              )}
            >
              {tier.isMostChosen && (
                <span className="absolute -top-2.5 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950 shadow-sm">
                  <Star className="h-2.5 w-2.5 fill-amber-950" />
                  Más elegido
                </span>
              )}
              <span className="text-sm font-bold text-[var(--color-text)]">{tier.label}</span>
              <span className="text-base font-extrabold tabular-nums text-[var(--color-text)]">
                {formatPrice(tier.totalPrice)}
              </span>
              {tier.savingsTotal > 0 && (
                <span className="text-[11px] font-semibold text-emerald-700">
                  Ahorras {formatPrice(tier.savingsTotal)}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </SectionContainer>
  );
}
