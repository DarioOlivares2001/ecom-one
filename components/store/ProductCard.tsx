"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import { clsx } from "clsx";
import { useCartStore } from "@/lib/cart/store";
import { pixelEvents } from "@/lib/pixel/events";
import { formatPrice } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toast";
import type { Product } from "@/lib/supabase/types";
import { productRequiresVariantChoice } from "@/lib/product/catalogVariants";

interface ProductCardProps {
  product: Product;
  priority?: boolean;
  selectedVariant?: string;
}

function calcDiscount(price: number, compareAtPrice: number): number {
  return Math.round((1 - price / compareAtPrice) * 100);
}

/** Misma apariencia que `Button` primary + sm + fullWidth (para CTA como enlace). */
const variantChoiceCtaClassName = clsx(
  "inline-flex w-full items-center justify-center rounded-[var(--radius-sm)] select-none",
  "h-8 px-3 text-sm font-medium gap-1.5",
  "transition-all duration-[var(--transition-fast)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-[var(--brand-ring)]",
  "[background:var(--brand-gradient)] text-white shadow-[0_8px_24px_rgba(0,0,0,0.16)]",
  "hover:brightness-105 active:scale-[0.98] active:brightness-95"
);

export function ProductCard({ product, priority = false, selectedVariant }: ProductCardProps) {
  const [adding, setAdding] = useState(false);
  const add = useCartStore((s) => s.add);
  const openDrawer = useCartStore((s) => s.openDrawer);

  const coverImage = product.images?.[0] ?? "";
  const needsVariantChoice = productRequiresVariantChoice(product);
  const inStock = product.stock > 0;

  const hasOffer =
    !!product.compare_at_price && product.compare_at_price > product.price;
  const discount = hasOffer ? calcDiscount(product.price, product.compare_at_price!) : 0;

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    if (productRequiresVariantChoice(product) || adding || !inStock) return;

    setAdding(true);
    try {
      const ok = add({
        product_id: product.id,
        has_variants: false,
        product_slug: product.slug,
        name: product.name,
        price: product.price,
        quantity: 1,
        image: coverImage,
        variant: selectedVariant,
        unitListPrice: product.price,
        discount_enabled: product.discount_enabled,
        discount_max_percent: product.discount_max_percent,
        discount_steps: product.discount_steps,
        discount_label: product.discount_label,
      });
      if (!ok) {
        toast.error("Este producto requiere elegir opciones en la ficha del producto.");
        return;
      }
      pixelEvents.addToCart(product, 1);
      openDrawer();
    } finally {
      setAdding(false);
    }
  }

  return (
    <article className="group flex w-full flex-col">
      {/* Image */}
      <Link
        href={`/productos/${product.slug}`}
        className="relative block aspect-square overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-background)]"
        aria-label={product.name}
        tabIndex={-1}
      >
        {coverImage ? (
          <Image
            src={coverImage}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            priority={priority}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--color-text-muted)]">
            <ShoppingBag className="h-10 w-10" strokeWidth={1} />
          </div>
        )}

        {/* Discount badge */}
        {hasOffer && (
          <div className="absolute left-2.5 top-2.5">
            <Badge variant="danger">−{discount}%</Badge>
          </div>
        )}

        {/* Out of stock overlay */}
        {product.stock === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
            <Badge variant="default">Agotado</Badge>
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="mt-2 flex flex-col gap-1.5 px-0.5 sm:mt-3 sm:gap-2">
        <Link href={`/productos/${product.slug}`} className="group/name min-h-0">
          <h3 className="line-clamp-2 text-xs font-medium leading-snug text-[var(--color-text)] sm:text-sm group-hover/name:underline group-hover/name:underline-offset-2">
            {product.name}
          </h3>
        </Link>

        {/* Prices */}
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-1.5 gap-x-2 sm:gap-2">
            <span className="text-sm font-bold tabular-nums text-[var(--color-text)] sm:text-base">
              {formatPrice(product.price)}
            </span>
            {hasOffer && (
              <span className="text-xs text-[var(--color-text-muted)] line-through sm:text-sm tabular-nums">
                {formatPrice(product.compare_at_price!)}
              </span>
            )}
          </div>
        </div>

        {/* CTA: variantes → solo enlace a ficha (nunca add / drawer); sin variantes → agregar */}
        {needsVariantChoice ? (
          <Link
            href={`/productos/${product.slug}`}
            className={clsx(variantChoiceCtaClassName, "mt-0.5 sm:mt-1")}
          >
            Ver opciones
          </Link>
        ) : (
          <Button
            type="button"
            onClick={handleAddToCart}
            loading={adding}
            disabled={!inStock}
            size="sm"
            fullWidth
            className="mt-0.5 sm:mt-1"
          >
            {inStock ? (
              "Agregar"
            ) : (
              "Agotado"
            )}
          </Button>
        )}
      </div>
    </article>
  );
}
