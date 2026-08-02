"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { useCartStore } from "@/lib/cart/store";
import type { CheckoutRecProduct } from "@/lib/checkout/recommendations";
import { formatPrice } from "@/lib/utils/format";

type CheckoutRecommendationsProps = {
  subtotal: number;
  freeShippingThreshold: number;
};

/** Si falta menos o igual a esto para envío gratis, se refuerza el mensaje con 🚚 */
const NEAR_FREE_SHIPPING_GAP = 8_500;

export function CheckoutRecommendations({
  subtotal,
  freeShippingThreshold,
}: CheckoutRecommendationsProps) {
  const items = useCartStore((s) => s.items);
  const add = useCartStore((s) => s.add);
  const [products, setProducts] = useState<CheckoutRecProduct[]>([]);
  const [title, setTitle] = useState("Antes de pagar, muchos agregan esto");
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const addBusyRef = useRef(false);

  const cartProductIds = useMemo(
    () => Array.from(new Set(items.map((i) => i.product_id))).sort(),
    [items]
  );
  const cartProductNames = useMemo(
    () => items.map((i) => i.name).filter(Boolean),
    [items]
  );
  const excludeKey = useMemo(() => cartProductIds.join(","), [cartProductIds]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/checkout/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            excludeProductIds: cartProductIds,
            cartProductNames,
          }),
        });
        const data = (await res.json()) as { title?: string; products?: CheckoutRecProduct[] };
        if (!cancelled) {
          setTitle(
            typeof data.title === "string" && data.title.trim()
              ? data.title
              : "Antes de pagar, muchos agregan esto"
          );
          // Filtro defensivo: solo productos con descuento habilitado y tope > 0.
          const safe = (Array.isArray(data.products) ? data.products : []).filter(
            (p) =>
              p &&
              p.discount_enabled === true &&
              Number(p.discount_max_percent) > 0
          );
          setProducts(safe);
        }
      } catch {
        if (!cancelled) {
          setProducts([]);
          setTitle("Antes de pagar, muchos agregan esto");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cartProductIds, cartProductNames, excludeKey]);

  const handleAdd = useCallback(
    (p: CheckoutRecProduct) => {
      if (addBusyRef.current) return;
      addBusyRef.current = true;
      const image = p.images?.[0] ?? "";
      setAddingId(p.id);
      try {
        // Línea de upsell: precio fijo con `applied_discount_percent` (= 5% o cap).
        // No usa discount_steps; no escala por cantidad.
        const effectivePrice =
          typeof p.offerPrice === "number" && p.offerPrice > 0 ? p.offerPrice : p.price;
        const discountPct =
          typeof p.discountPercent === "number" && p.discountPercent > 0
            ? p.discountPercent
            : 0;
        add({
          product_id: p.id,
          has_variants: false,
          product_slug: p.slug,
          name: p.name,
          price: effectivePrice,
          quantity: 1,
          image,
          source: "upsell",
          applied_discount_percent: discountPct,
          expected_unit_price: effectivePrice,
          unitListPrice: p.price,
          discount_enabled: p.discount_enabled === true,
          discount_max_percent:
            typeof p.discount_max_percent === "number" && Number.isFinite(p.discount_max_percent)
              ? p.discount_max_percent
              : undefined,
          isUpsellOffer: true,
          originalPrice: p.price,
          discountPercent: discountPct,
        });
        setProducts((prev) => prev.filter((x) => x.id !== p.id));
      } finally {
        addBusyRef.current = false;
        setAddingId(null);
      }
    },
    [add]
  );

  const remainingForFree = Math.max(0, freeShippingThreshold - subtotal);
  const nearFreeShipping =
    subtotal < freeShippingThreshold &&
    remainingForFree > 0 &&
    remainingForFree <= NEAR_FREE_SHIPPING_GAP;

  if (!loading && products.length === 0) return null;

  return (
    <div className="mt-5 border-t border-[var(--color-border)]/80 pt-5">
      <h3 className="text-sm font-semibold leading-snug text-[var(--color-text)]">
        🧠 {title}
      </h3>

      <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
        💡 Agrega este producto y aprovecha mejor tu envío
        {nearFreeShipping && (
          <>
            <br />
            <span className="font-medium text-[var(--color-text)]">
              🚚 Esto te ayuda a alcanzar envío gratis
            </span>
          </>
        )}
      </p>

      {loading ? (
        <div className="mt-3 space-y-2">
          <div className="h-14 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-border)]/40" />
          <div className="h-14 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-border)]/30" />
        </div>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {products.map((p) => (
            <li
              key={p.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)]/70 bg-[var(--color-background)] p-2.5"
            >
              <div className="flex gap-2.5">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-surface)]">
                  {p.images?.[0] ? (
                    <Image
                      src={p.images[0]}
                      alt={p.name}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--color-text-muted)]">
                      —
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs font-medium leading-snug text-[var(--color-text)]">
                    {p.name}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-[var(--color-text-muted)]">
                    {p.offerPrice && p.offerPrice < p.price ? (
                      <>
                        <span className="text-[var(--color-text)]">{formatPrice(p.offerPrice)}</span>{" "}
                        <span className="line-through opacity-70">{formatPrice(p.price)}</span>
                      </>
                    ) : (
                      formatPrice(p.price)
                    )}
                  </p>
                  {p.savings && p.savings > 0 && (
                    <p className="mt-0.5 text-[10px] font-medium text-[var(--color-success)]">
                      Ahorras {formatPrice(p.savings)}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => handleAdd(p)}
                    disabled={addingId === p.id}
                    className={clsx(
                      "mt-1.5 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-[11px] font-semibold text-[var(--color-text)] transition-colors",
                      "hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5",
                      "disabled:opacity-50"
                    )}
                  >
                    {addingId === p.id
                      ? "Agregando…"
                      : `Agregar combo${
                          p.offerPrice && p.offerPrice < p.price
                            ? ` por ${formatPrice(p.offerPrice)}`
                            : ""
                        }`}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
