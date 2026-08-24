import { sortSectionsForTheme } from "@/lib/product/sections/sortSectionsForTheme";
import { Gallery } from "./shared/Gallery";
import { PurchasePanel } from "./shared/PurchasePanel";
import { ProductContentBlock } from "./shared/ProductContentBlock";
import { ReviewsSection } from "./shared/ReviewsSection";
import { RelatedProductsSection } from "./shared/RelatedProductsSection";
import type { ProductLayoutProps } from "./types";

/**
 * Tema "Bienestar y suplementos" — foco editorial y premium: más aire entre
 * bloques, sin banner de urgencia, y los bloques del producto priorizan
 * beneficios → uso diario/presentación → versatilidad antes que el resto
 * (ver sortSectionsForTheme — nunca reordena el contenido dentro de un
 * bloque, solo el orden entre tipos de bloque). "También te puede
 * interesar" ya llega vacío desde el servidor si no hay nada realmente afín
 * (ver page.tsx: allowGenericFallback=false para este tema), así que acá
 * simplemente no se renderiza — RelatedProductsSection ya maneja ese caso.
 */
export function WellnessProductLayout({
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
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-20 lg:px-8">
        <Gallery key={product.id} images={images} name={product.name} />
        <div className="mt-8 lg:mt-0">
          <PurchasePanel
            product={product}
            commercial={commercial}
            variants={variants}
            avgRating={reviews.avgRating}
            reviewCount={reviews.list.length}
            showUrgency={false}
          />
        </div>
      </div>

      <ProductContentBlock
        product={product}
        hasModularSections={hasModularSections}
        hasDescription={hasDescription}
        sortSections={(sections) => sortSectionsForTheme(sections, "wellness")}
        className="mt-16 sm:mt-24"
      />

      <ReviewsSection reviews={reviews} roomy />
      <RelatedProductsSection upsell={upsell} />
    </>
  );
}
