"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCartStore } from "@/lib/cart/store";
import { pixelEvents } from "@/lib/pixel/events";
import { toast } from "@/components/ui/Toast";
import { StickyAddToCart } from "@/components/store/StickyAddToCart";
import type { Product, ProductVariant, Review } from "@/lib/db/types";
import type { ProductUpsellSuggestion } from "@/lib/product/upsell";
import { isAllowedImageSrc, sanitizeImageUrls } from "@/lib/images/isAllowedImageSrc";
import { hasVisibleProductSections } from "@/components/store/product-sections/ProductSectionsRenderer";
import { ProductLayoutRenderer } from "@/components/store/product-layouts/ProductLayoutRenderer";
import { ReviewModal } from "@/components/store/product-layouts/shared/ReviewModal";
import type { ProductLayoutProps } from "@/components/store/product-layouts/types";
import { resolveStorefrontTheme } from "@/lib/store-settings/storefrontThemes";
import { variantLabel } from "@/components/store/product-layouts/shared/variantLabel";

interface Props {
  product: Product;
  reviews: Review[];
  variants: ProductVariant[];
  upsellSuggestions?: ProductUpsellSuggestion[];
  /** Tema estructural (layout/composición) resuelto en el servidor — nunca colores. */
  storefrontTheme?: string;
}

/**
 * Orquestador: dueño de todo el estado y la lógica comercial (carrito,
 * variantes, cantidad, upsell). No decide estructura/orden visual — eso lo
 * hace `ProductLayoutRenderer` según `storefrontTheme`, componiendo los
 * mismos datos y handlers que se arman acá (ver `ProductLayoutProps`).
 */
export function ProductClient({
  product,
  reviews,
  variants,
  upsellSuggestions = [],
  storefrontTheme,
}: Props) {
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [qty, setQty] = useState(1);
  const mainCTARef = useRef<HTMLButtonElement>(null);
  const [addedSuggestionId, setAddedSuggestionId] = useState<string | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

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
  const displayCompareAt = selectedRealVariant?.compare_at_price ?? product.compare_at_price;
  const displayStock = selectedRealVariant?.stock ?? product.stock;
  const rawDisplayImage = selectedRealVariant?.image_url || product.images?.[0] || "";
  const displayImage = isAllowedImageSrc(rawDisplayImage) ? rawDisplayImage : "";

  const hasOffer = !!displayCompareAt && displayCompareAt > displayPrice;
  const discount = hasOffer ? Math.round((1 - displayPrice / displayCompareAt!) * 100) : 0;
  const savedAmount = hasOffer ? displayCompareAt! - displayPrice : 0;

  const variantGroups = product.variants ? (product.variants as Record<string, string[]>) : null;

  const selectedLegacyVariantLabel =
    Object.entries(selectedVariants)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" / ") || undefined;

  const selectedRealVariantLabel = selectedRealVariant
    ? variantLabel(selectedRealVariant.option_values)
    : undefined;

  const avgRating =
    reviews.length > 0 ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length : null;
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
    displayStock < 10 ? "🔥 Quedan pocas unidades" : displayStock <= 30 ? "⚡ Alta demanda hoy" : null;
  const cartProductIds = useMemo(() => new Set(cartItems.map((i) => i.product_id)), [cartItems]);
  const visibleUpsells = useMemo(
    () => upsellSuggestions.filter((s) => !cartProductIds.has(s.id)).slice(0, 4),
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
          (selectedRealVariant?.option_values as Record<string, string> | undefined) ?? undefined,
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

  const layoutProps: ProductLayoutProps = {
    product,
    images: sanitizeImageUrls(product.images),
    hasDescription,
    hasModularSections,
    commercial: {
      displayPrice,
      displayCompareAt,
      displayStock,
      hasOffer,
      discount,
      savedAmount,
      qty,
      setQty,
      adding,
      handleAdd,
      mainCTARef,
      urgencyMessage,
    },
    variants: {
      hasRealVariants,
      activeVariants,
      selectedRealVariant,
      setSelectedVariantId,
      variantGroups,
      selectedVariants,
      setSelectedVariants,
    },
    reviews: {
      list: reviews,
      avgRating,
      featuredReview,
      regularReviews,
      onWriteReview: () => setReviewModalOpen(true),
    },
    upsell: {
      visible: visibleUpsells,
      addedSuggestionId,
      onAdd: handleAddSuggestion,
    },
  };

  return (
    <>
      <ProductLayoutRenderer theme={resolveStorefrontTheme(storefrontTheme)} {...layoutProps} />

      <ReviewModal productId={product.id} open={reviewModalOpen} onClose={() => setReviewModalOpen(false)} />

      {/* ── Sticky CTA — mobile only, igual en los 4 temas ── */}
      <StickyAddToCart
        product={product}
        quantity={qty}
        baseUnitPrice={displayPrice}
        compareAtPrice={displayCompareAt ?? null}
        stock={displayStock}
        image={displayImage}
        targetRef={mainCTARef}
        selectedVariant={selectedRealVariantLabel ?? selectedLegacyVariantLabel}
        selectedVariantId={selectedRealVariant?.id}
        selectedOptionValues={
          (selectedRealVariant?.option_values as Record<string, string> | undefined) ?? undefined
        }
      />
    </>
  );
}
