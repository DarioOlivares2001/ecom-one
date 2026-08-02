import type {
  BeforeAfterData,
  BenefitsData,
  FaqData,
  MediaStripData,
  ProductSection,
  ProductSectionType,
  TestimonialsData,
} from "./types";

/**
 * ID corto y URL-safe sin dependencias externas. Suficiente para distinguir
 * bloques dentro de un mismo producto.
 */
function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().split("-")[0];
  }
  return `sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Defaults por tipo ───────────────────────────────────────────────────────

export function defaultBenefitsData(): BenefitsData {
  return {
    heading: "Por qué te va a encantar",
    items: [
      { icon: "shield", title: "Calidad garantizada", description: "Producto probado y aprobado." },
      { icon: "truck", title: "Envío rápido", description: "Despacho dentro de 24 h hábiles." },
      { icon: "heart", title: "Pensado para tu mascota", description: "Diseño que se adapta a su rutina." },
    ],
  };
}

export function defaultMediaStripData(): MediaStripData {
  return {
    image_url: "",
    alt: "",
    caption: "",
    aspect: "16/9",
  };
}

export function defaultFaqData(): FaqData {
  return {
    heading: "Preguntas frecuentes",
    items: [
      {
        question: "¿Cuánto demora el envío?",
        answer: "Despachamos dentro de 24 h hábiles desde Santiago.",
      },
    ],
  };
}

export function defaultTestimonialsData(): TestimonialsData {
  return {
    heading: "Lo que dicen quienes ya lo probaron",
    items: [
      {
        name: "Camila",
        city: "Santiago",
        rating: 5,
        comment: "Excelente producto, mi gata lo amó.",
        photo_url: "",
        date_label: "hace 2 semanas",
      },
    ],
  };
}

export function defaultBeforeAfterData(): BeforeAfterData {
  return {
    heading: "Antes y después",
    before_title: "Antes",
    before_description: "❌ Malos olores\n❌ Arena en el piso\n❌ Limpieza constante",
    before_image_url: "",
    after_title: "Después",
    after_description: "✅ Ambiente limpio\n✅ Menos suciedad\n✅ Tu casa huele mejor",
    after_image_url: "",
    layout: "side_by_side",
  };
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createNewSection(
  type: ProductSectionType,
  order: number,
): ProductSection {
  const base = { id: genId(), enabled: true, order };
  switch (type) {
    case "benefits":
      return { ...base, type: "benefits", data: defaultBenefitsData() };
    case "media_strip":
      return { ...base, type: "media_strip", data: defaultMediaStripData() };
    case "faq":
      return { ...base, type: "faq", data: defaultFaqData() };
    case "testimonials":
      return { ...base, type: "testimonials", data: defaultTestimonialsData() };
    case "before_after":
      return { ...base, type: "before_after", data: defaultBeforeAfterData() };
    default: {
      const _exhaustive: never = type;
      throw new Error(`Tipo de sección desconocido: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Recalcula `order` en base a la posición del array. Llamar después de
 * cualquier mutación que cambie el orden.
 */
export function reindexSections(list: ProductSection[]): ProductSection[] {
  return list.map((section, index) => ({ ...section, order: index }));
}
