import { sortSectionsForTheme } from "@/lib/product/sections/sortSectionsForTheme";
import { Gallery } from "./shared/Gallery";
import { PurchasePanel } from "./shared/PurchasePanel";
import { ProductContentBlock } from "./shared/ProductContentBlock";
import { ReviewsSection } from "./shared/ReviewsSection";
import { RelatedProductsSection } from "./shared/RelatedProductsSection";
import type { ProductLayoutProps } from "./types";

/**
 * Tema "Tecnología y herramientas" — presentación densa y técnica: panel de
 * compra más compacto, y los bloques del producto priorizan medidas →
 * versatilidad → uso antes que el resto (ver sortSectionsForTheme) cuando
 * existen en la ficha.
 */
export function TechnicalProductLayout({
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
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-10 lg:px-8">
        <Gallery key={product.id} images={images} name={product.name} />
        <div className="mt-5 lg:mt-0">
          <PurchasePanel
            product={product}
            commercial={commercial}
            variants={variants}
            avgRating={reviews.avgRating}
            reviewCount={reviews.list.length}
            density="compact"
            showUrgency={false}
          />
        </div>
      </div>

      <ProductContentBlock
        product={product}
        hasModularSections={hasModularSections}
        hasDescription={hasDescription}
        sortSections={(sections) => sortSectionsForTheme(sections, "technical")}
        className="mt-10 sm:mt-12"
      />

      <ReviewsSection reviews={reviews} />
      <RelatedProductsSection upsell={upsell} />
    </>
  );
}
