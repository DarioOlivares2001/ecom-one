import type { ProductSectionList, ProductSectionType } from "./types";
import type { StorefrontThemeId } from "@/lib/store-settings/storefrontThemes";

/**
 * Prioridad de TIPOS de bloque por tema estructural — nunca reordena el
 * contenido dentro de un bloque ni altera su texto, solo decide qué grupo de
 * tipos aparece antes cuando el tema lo pide explícitamente. `conversion-general`
 * no tiene entrada acá: no reordena, se respeta el `order` que el admin ya
 * definió para esa ficha.
 */
const THEME_SECTION_TYPE_PRIORITY: Partial<Record<StorefrontThemeId, ProductSectionType[]>> = {
  // Bienestar: beneficios → fórmula/uso (no hay tipo dedicado a "fórmula",
  // así que cae naturalmente donde el admin lo haya puesto) → confianza
  // (testimonios). El resto de bloques conserva su orden relativo original.
  "wellness-supplements": ["benefits", "usage", "testimonials"],
};

/**
 * Reordena los bloques visibles de una ficha según la jerarquía sugerida del
 * tema estructural activo. Pura y determinista: misma entrada -> misma
 * salida. Nunca muta los objetos de sección ni su contenido — solo cambia el
 * orden del array. Dentro de un mismo grupo de prioridad (o fuera de la lista
 * de prioridad), se preserva el orden relativo original (sort estable) para
 * no desordenar arbitrariamente lo que el admin ya definió.
 */
export function sortSectionsForTheme(
  sections: ProductSectionList,
  theme: StorefrontThemeId
): ProductSectionList {
  const priority = THEME_SECTION_TYPE_PRIORITY[theme];
  if (!priority || sections.length <= 1) return sections;

  return sections
    .map((section, index) => ({ section, index }))
    .sort((a, b) => {
      const rankA = priority.indexOf(a.section.type);
      const rankB = priority.indexOf(b.section.type);
      const safeRankA = rankA === -1 ? priority.length : rankA;
      const safeRankB = rankB === -1 ? priority.length : rankB;
      if (safeRankA !== safeRankB) return safeRankA - safeRankB;
      return a.index - b.index;
    })
    .map(({ section }) => section);
}
