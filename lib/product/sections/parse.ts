import type { ProductSectionList } from "./types";
import { productSectionsSchema } from "./types";

/**
 * Parseo seguro de `product_sections` para renderizado público.
 * - Acepta cualquier `unknown` y devuelve siempre un array (vacío si falla).
 * - Filtra elementos individuales inválidos en lugar de descartar todo el
 *   bloque cuando un solo item tiene un schema corrupto.
 * - Ordena por `order` ascendente.
 */
export function parseProductSectionsLoose(input: unknown): ProductSectionList {
  // Caso edge: algunos drivers/queries serializan JSONB como string. Intentamos
  // parsearlo antes de descartar.
  let normalized: unknown = input;
  if (typeof normalized === "string") {
    try {
      normalized = JSON.parse(normalized);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(normalized)) return [];

  const sectionItemSchema = productSectionsSchema.element;
  const valid: ProductSectionList = [];

  for (const raw of normalized) {
    const result = sectionItemSchema.safeParse(raw);
    if (result.success) {
      valid.push(result.data);
    }
  }

  return valid.sort((a, b) => a.order - b.order);
}

/**
 * Parseo estricto para escrituras del admin. Falla en bloque.
 */
export function parseProductSectionsStrict(input: unknown): ProductSectionList {
  return productSectionsSchema.parse(input);
}

/**
 * Devuelve sólo los bloques visibles para el usuario final.
 */
export function getVisibleSections(
  sections: ProductSectionList,
): ProductSectionList {
  return sections.filter((s) => s.enabled);
}
