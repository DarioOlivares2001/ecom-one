"use client";

import { getVisibleSections, parseProductSectionsLoose } from "@/lib/product/sections/parse";

import { BeforeAfterSection } from "./BeforeAfterSection";
import { BenefitsSection } from "./BenefitsSection";
import { FaqSection } from "./FaqSection";
import { MediaStripSection } from "./MediaStripSection";
import { SingleImageSection } from "./SingleImageSection";
import { TestimonialsSection } from "./TestimonialsSection";
import { VisualSequenceSection } from "./VisualSequenceSection";

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
    // Ritmo vertical entre bloques (24px mobile / 32px desktop): `gap` en vez
    // de márgenes por bloque para no depender de que ningún margin-collapse
    // ni utilidad tipo `space-y` termine anulándolo (justo lo que pasaba antes
    // acá: `space-y-0` pisaba el `margin-top` propio de cada `SectionContainer`
    // por especificidad CSS, pegando el título del bloque siguiente al
    // contenido del anterior). Cada bloque ya no trae su propio margen
    // vertical — este `gap` es la única fuente de separación entre bloques.
    <div className="grid gap-6 sm:gap-8">
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
          case "visual_sequence":
            return <VisualSequenceSection key={section.id} data={section.data} />;
          case "usage":
            return (
              <SingleImageSection
                key={section.id}
                type="usage"
                data={section.data}
                fallbackEyebrow="Cómo usarlo"
              />
            );
          case "measurements":
            return (
              <SingleImageSection
                key={section.id}
                type="measurements"
                data={section.data}
                fallbackEyebrow="Medidas"
              />
            );
          case "versatility":
            return (
              <SingleImageSection
                key={section.id}
                type="versatility"
                data={section.data}
                fallbackEyebrow="Versatilidad"
              />
            );
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
