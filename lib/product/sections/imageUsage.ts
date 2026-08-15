import { SECTION_REGISTRY, type ProductSectionList } from "./types";

export interface SectionImageUsage {
  id: string;
  label: string;
}

/**
 * Recorre `data` de una sección buscando si `url` aparece en algún campo de
 * texto, sin importar el nombre del campo (`image_url`, `before_image_url`,
 * `slides[].image_url`, `photo_url`, etc.) ni cuán anidado esté. Genérico a
 * propósito: cubre bloques nuevos sin tener que listar cada campo a mano.
 */
function dataReferencesUrl(data: unknown, url: string): boolean {
  if (typeof data === "string") return data === url;
  if (Array.isArray(data)) return data.some((item) => dataReferencesUrl(item, url));
  if (data && typeof data === "object") {
    return Object.values(data).some((value) => dataReferencesUrl(value, url));
  }
  return false;
}

/** Devuelve los bloques (id + etiqueta legible) que referencian `url` en algún campo. */
export function findSectionsUsingImage(
  sections: ProductSectionList,
  url: string
): SectionImageUsage[] {
  const trimmed = url.trim();
  if (!trimmed) return [];

  return sections
    .filter((section) => dataReferencesUrl(section.data, trimmed))
    .map((section) => ({
      id: section.id,
      label: SECTION_REGISTRY.find((e) => e.type === section.type)?.label ?? section.type,
    }));
}
