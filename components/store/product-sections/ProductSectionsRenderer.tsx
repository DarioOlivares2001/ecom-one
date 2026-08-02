"use client";

import { getVisibleSections, parseProductSectionsLoose } from "@/lib/product/sections/parse";

import { BeforeAfterSection } from "./BeforeAfterSection";
import { BenefitsSection } from "./BenefitsSection";
import { FaqSection } from "./FaqSection";
import { MediaStripSection } from "./MediaStripSection";
import { TestimonialsSection } from "./TestimonialsSection";

interface ProductSectionsRendererProps {
  /**
   * Valor crudo de `products.product_sections` (JSONB). Puede ser cualquier
   * cosa: el componente lo valida con Zod y descarta lo inválido.
   */
  sections: unknown;
}

/**
 * Renderiza dinámicamente los bloques modulares de la ficha de producto.
 * Devuelve `null` si no hay bloques visibles (caller decide el fallback).
 */
export function ProductSectionsRenderer({ sections }: ProductSectionsRendererProps) {
  const parsed = parseProductSectionsLoose(sections);
  const visible = getVisibleSections(parsed);

  if (visible.length === 0) return null;

  return (
    <div className="space-y-0">
      {visible.map((section) => {
        switch (section.type) {
          case "benefits":
            return <BenefitsSection key={section.id} data={section.data} />;
          case "media_strip":
            return <MediaStripSection key={section.id} data={section.data} />;
          case "faq":
            return <FaqSection key={section.id} data={section.data} />;
          case "testimonials":
            return <TestimonialsSection key={section.id} data={section.data} />;
          case "before_after":
            return <BeforeAfterSection key={section.id} data={section.data} />;
          default: {
            // Garantía de exhaustividad para futuras secciones nuevas.
            const _exhaustive: never = section;
            void _exhaustive;
            return null;
          }
        }
      })}
    </div>
  );
}

/**
 * Helper utilitario: indica si el JSON crudo tiene al menos un bloque visible
 * para que el caller pueda decidir si mostrar el sistema modular o el HTML
 * legacy de `product.description`.
 */
export function hasVisibleProductSections(sections: unknown): boolean {
  const parsed = parseProductSectionsLoose(sections);
  return parsed.some((s) => s.enabled);
}
