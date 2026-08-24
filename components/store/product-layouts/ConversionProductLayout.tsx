import { Gallery } from "./shared/Gallery";
import { PurchasePanel } from "./shared/PurchasePanel";
import { ProductContentBlock } from "./shared/ProductContentBlock";
import { ReviewsSection } from "./shared/ReviewsSection";
import { RelatedProductsSection } from "./shared/RelatedProductsSection";
import type { ProductLayoutProps } from "./types";

/**
 * Tema "Conversión directa" — layout base (el mismo que ya existía antes de
 * separar temas estructurales). Precio, oferta, CTA y compra rápida por
 * delante; bloques del producto en el orden que el admin ya definió.
 */
export function ConversionProductLayout({
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
          />
        </div>
      </div>

      <ProductContentBlock
        product={product}
        hasModularSections={hasModularSections}
        hasDescription={hasDescription}
        commercial={{ qty: commercial.qty, setQty: commercial.setQty }}
      />

      <ReviewsSection reviews={reviews} />
      <RelatedProductsSection upsell={upsell} />
    </>
  );
}
