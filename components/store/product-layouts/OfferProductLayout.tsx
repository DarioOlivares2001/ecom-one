import { Gallery } from "./shared/Gallery";
import { PurchasePanel } from "./shared/PurchasePanel";
import { ProductContentBlock } from "./shared/ProductContentBlock";
import { ReviewsSection } from "./shared/ReviewsSection";
import { RelatedProductsSection } from "./shared/RelatedProductsSection";
import type { ProductLayoutProps } from "./types";

/**
 * Tema "Oferta dinámica" — foco en catálogo general y promociones reales:
 * el panel de compra suma el bloque de descuento por cantidad
 * (ProductTieredDiscount, ya existente y auto-gateado: no aparece si el
 * producto no tiene descuentos reales configurados). Bloques del producto en
 * el orden que el admin ya definió — sin reordenar por tipo.
 */
export function OfferProductLayout({
  product,
  images,
  hasDescription,
  hasModularSections,
  commercial,
  variants,
  reviews,
  upsell,
}: ProductLayoutProps) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <Gallery key={product.id} images={images} name={product.name} />
        <div className="mt-6 lg:mt-0">
          <PurchasePanel
            product={product}
            commercial={commercial}
            variants={variants}
            avgRating={reviews.avgRating}
            reviewCount={reviews.list.length}
            showTieredDiscount
          />
        </div>
      </div>

      <ProductContentBlock
        product={product}
        hasModularSections={hasModularSections}
        hasDescription={hasDescription}
      />

      <ReviewsSection reviews={reviews} />
      <RelatedProductsSection upsell={upsell} />
    </>
  );
}
