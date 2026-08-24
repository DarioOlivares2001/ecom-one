import { SECTION_REGISTRY, type ProductSection, type ProductSectionList } from "./types";

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

/**
 * Quita toda referencia a `url` de una sección, a mano por tipo (no genérico
 * como `dataReferencesUrl`) porque la limpieza correcta depende del schema:
 * un campo de imagen único y opcional se vacía a `""`, pero una lámina de
 * `visual_sequence` requiere `image_url` no vacío — ahí la limpieza correcta
 * es quitar la lámina completa, no dejar un dato inválido.
 */
function purgeFromSection(section: ProductSection, url: string): ProductSection {
  switch (section.type) {
    case "benefits":
      return section.data.image_url === url
        ? { ...section, data: { ...section.data, image_url: "" } }
        : section;
    case "media_strip":
      return section.data.image_url === url
        ? { ...section, data: { ...section.data, image_url: "" } }
        : section;
    case "usage":
      return section.data.image_url === url
        ? { ...section, data: { ...section.data, image_url: "" } }
        : section;
    case "measurements":
      return section.data.image_url === url
        ? { ...section, data: { ...section.data, image_url: "" } }
        : section;
    case "versatility":
      return section.data.image_url === url
        ? { ...section, data: { ...section.data, image_url: "" } }
        : section;
    case "before_after": {
      const data = { ...section.data };
      let changed = false;
      if (data.before_image_url === url) {
        data.before_image_url = "";
        changed = true;
      }
      if (data.after_image_url === url) {
        data.after_image_url = "";
        changed = true;
      }
      return changed ? { ...section, data } : section;
    }
    case "visual_sequence": {
      const nextSlides = section.data.slides.filter((slide) => slide.image_url !== url);
      return nextSlides.length === section.data.slides.length
        ? section
        : { ...section, data: { ...section.data, slides: nextSlides } };
    }
    case "testimonials": {
      const nextItems = section.data.items.map((item) =>
        item.photo_url === url ? { ...item, photo_url: "" } : item
      );
      return nextItems.some((item, i) => item !== section.data.items[i])
        ? { ...section, data: { ...section.data, items: nextItems } }
        : section;
    }
    case "faq":
      return section;
    case "quantity_packs":
      return section;
    case "offer_countdown":
      return section;
    default: {
      const _exhaustive: never = section;
      return _exhaustive;
    }
  }
}

/** Quita toda referencia a `url` de todos los bloques (ver `purgeFromSection`). */
export function purgeImageReference(sections: ProductSectionList, url: string): ProductSectionList {
  const trimmed = url.trim();
  if (!trimmed) return sections;
  return sections.map((section) => purgeFromSection(section, trimmed));
}
