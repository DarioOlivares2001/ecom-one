import { motion } from "framer-motion";
import type { Product } from "@/lib/db/types";
import type { ProductSectionList } from "@/lib/product/sections/types";
import {
  ProductSectionsRenderer,
} from "@/components/store/product-sections/ProductSectionsRenderer";

interface ProductContentBlockProps {
  product: Product;
  hasModularSections: boolean;
  hasDescription: boolean;
  /** Reordena los bloques modulares visibles según el tema estructural activo (ver sortSectionsForTheme). */
  sortSections?: (sections: ProductSectionList) => ProductSectionList;
  className?: string;
}

/**
 * Bloques del producto: los bloques modulares curados por el admin
 * (`product_sections`) si existen, o el HTML legado de `description` como
 * fallback — igual en todos los temas estructurales. Nunca inventa ni altera
 * contenido, solo decide si hay algo que mostrar.
 */
export function ProductContentBlock({
  product,
  hasModularSections,
  hasDescription,
  sortSections,
  className = "mt-12 sm:mt-16",
}: ProductContentBlockProps) {
  if (hasModularSections) {
    return (
      <div className={className}>
        <ProductSectionsRenderer sections={product.product_sections} sortSections={sortSections} />
      </div>
    );
  }

  if (!hasDescription) return null;

  return (
    <section className="mx-auto mt-20 max-w-2xl px-4 sm:px-6 lg:px-8">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-8 font-display text-2xl font-bold text-[var(--color-text)] sm:text-3xl"
      >
        Sobre este producto
      </motion.h2>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="text-[var(--color-text-muted)] [&_a]:underline [&_a:hover]:opacity-70 [&_h1]:mb-3 [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-[var(--color-text)] [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[var(--color-text)] [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:font-semibold [&_h3]:text-[var(--color-text)] [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-4 [&_p]:text-base [&_p]:leading-relaxed [&_strong]:font-semibold [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: product.description! }}
      />
    </section>
  );
}
