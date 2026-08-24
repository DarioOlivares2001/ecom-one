import type {
  BeforeAfterData,
  BenefitsData,
  FaqData,
  MeasurementsData,
  MediaStripData,
  OfferCountdownData,
  ProductSection,
  ProductSectionType,
  QuantityPacksData,
  TestimonialsData,
  UsageData,
  VersatilityData,
  VisualSequenceData,
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
    heading: "Beneficios",
    description: "",
    image_url: "",
    alt: "",
    items: [
      { icon: "shield", title: "Calidad verificada", description: "Edita este texto con lo que respalda a tu producto." },
      { icon: "truck", title: "Despacho a domicilio", description: "Coordinamos el envío según la información del checkout." },
      { icon: "sparkles", title: "Pensado para tu rutina", description: "Describe aquí cómo se integra a tu día a día." },
    ],
  };
}

export function defaultUsageData(): UsageData {
  return { heading: "Cómo usarlo", description: "", image_url: "", alt: "" };
}

export function defaultMeasurementsData(): MeasurementsData {
  return { heading: "Medidas", description: "", image_url: "", alt: "" };
}

export function defaultVersatilityData(): VersatilityData {
  return { heading: "Versatilidad", description: "", image_url: "", alt: "" };
}

export function defaultMediaStripData(): MediaStripData {
  return {
    description: "",
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
        question: "Escribe aquí una pregunta frecuente sobre este producto.",
        answer: "Escribe aquí la respuesta. Puedes agregar más preguntas con el botón de abajo.",
      },
    ],
  };
}

export function defaultTestimonialsData(): TestimonialsData {
  return {
    heading: "Lo que dicen quienes ya lo probaron",
    items: [
      {
        name: "Nombre del cliente",
        city: "",
        rating: 5,
        comment: "Reemplaza este ejemplo con un comentario real de un cliente.",
        photo_url: "",
        date_label: "",
      },
    ],
  };
}

export function defaultBeforeAfterData(): BeforeAfterData {
  return {
    heading: "",
    before_title: "Antes",
    before_description: "",
    before_image_url: "",
    after_title: "Después",
    after_description: "",
    after_image_url: "",
    layout: "side_by_side",
  };
}

export function defaultVisualSequenceData(): VisualSequenceData {
  return { slides: [] };
}

export function defaultQuantityPacksData(): QuantityPacksData {
  return { heading: "Packs y ahorro", description: "", steps: [], mostChosenMinQty: null };
}

export function defaultOfferCountdownData(): OfferCountdownData {
  return { heading: "Oferta por tiempo limitado", message: "", ends_at: "" };
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
    case "visual_sequence":
      return { ...base, type: "visual_sequence", data: defaultVisualSequenceData() };
    case "usage":
      return { ...base, type: "usage", data: defaultUsageData() };
    case "measurements":
      return { ...base, type: "measurements", data: defaultMeasurementsData() };
    case "versatility":
      return { ...base, type: "versatility", data: defaultVersatilityData() };
    case "quantity_packs":
      return { ...base, type: "quantity_packs", data: defaultQuantityPacksData() };
    case "offer_countdown":
      return { ...base, type: "offer_countdown", data: defaultOfferCountdownData() };
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
