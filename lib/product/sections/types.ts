import { z } from "zod";

/**
 * Bloques modulares de la ficha de producto.
 *
 * Cada bloque tiene:
 *  - `id`: string único dentro del producto (generado en admin).
 *  - `type`: discriminador del tipo de bloque.
 *  - `enabled`: si se renderiza públicamente.
 *  - `order`: posición ascendente (0 = primero).
 *  - `data`: payload validado por tipo.
 *
 * El array se guarda en `products.product_sections` (JSONB). La validación
 * Zod se ejecuta en server actions antes de persistir y en el front antes
 * de renderizar.
 */

// ─── Items por tipo ──────────────────────────────────────────────────────────

export const BENEFIT_ICONS = [
  "shield",
  "truck",
  "leaf",
  "heart",
  "sparkles",
  "check",
  "star",
  "package",
  "smile",
  "clock",
] as const;
export type BenefitIcon = (typeof BENEFIT_ICONS)[number];

export const benefitItemSchema = z.object({
  icon: z.enum(BENEFIT_ICONS),
  title: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(240),
});

export const MEDIA_STRIP_ASPECTS = ["16/9", "4/3", "1/1"] as const;
export type MediaStripAspect = (typeof MEDIA_STRIP_ASPECTS)[number];

export const benefitsDataSchema = z.object({
  heading: z.string().trim().max(80).optional(),
  /** Texto visible introductorio de toda la sección, antes de imagen/tarjetas. Distinto de `items[].description`. */
  description: z.string().trim().max(2000).optional(),
  /** Imagen principal opcional de la sección, elegida desde la biblioteca del producto. */
  image_url: z.string().url().or(z.literal("")).default(""),
  /** Solo accesibilidad (atributo `alt` de la imagen) — nunca se muestra como texto comercial. */
  alt: z.string().trim().max(180).optional(),
  items: z.array(benefitItemSchema).min(1).max(6),
});

/**
 * Bloques de una sola imagen principal ("Uso / Cómo usar", "Medidas",
 * "Versatilidad"). Mismo shape que `mediaStripDataSchema` pero como tipos
 * separados: el admin los distingue por nombre al armar la ficha.
 */
function singleImageDataSchema() {
  return z.object({
    heading: z.string().trim().max(80).optional(),
    /** Texto comercial visible, multilínea. Distinto de `alt` (accesibilidad, nunca se muestra). */
    description: z.string().trim().max(2000).optional(),
    image_url: z.string().url().or(z.literal("")).default(""),
    /** Solo accesibilidad (atributo `alt` de la imagen) — nunca se muestra como texto comercial. */
    alt: z.string().trim().max(180).optional(),
  });
}

export const usageDataSchema = singleImageDataSchema();
export const measurementsDataSchema = singleImageDataSchema();
export const versatilityDataSchema = singleImageDataSchema();

export const mediaStripDataSchema = z.object({
  /** Texto comercial visible, multilínea. Distinto de `caption` (leyenda pequeña bajo la imagen) y de `alt` (accesibilidad). */
  description: z.string().trim().max(2000).optional(),
  image_url: z.string().url().or(z.literal("")).default(""),
  /** Solo accesibilidad (atributo `alt` de la imagen) — nunca se muestra como texto comercial. */
  alt: z.string().trim().max(180).optional(),
  caption: z.string().trim().max(140).optional(),
  aspect: z.enum(MEDIA_STRIP_ASPECTS).default("16/9"),
});

export const faqItemSchema = z.object({
  question: z.string().trim().min(1).max(180),
  answer: z.string().trim().min(1).max(800),
});

export const faqDataSchema = z.object({
  heading: z.string().trim().max(80).optional(),
  items: z.array(faqItemSchema).min(1).max(20),
});

export const testimonialItemSchema = z.object({
  name: z.string().trim().min(1).max(60),
  city: z.string().trim().max(60).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().trim().min(1).max(400),
  /** URL pública opcional. Vacío = sin foto. */
  photo_url: z.string().url().or(z.literal("")).optional(),
  /** Etiqueta de tiempo libre (ej. "hace 2 semanas"). */
  date_label: z.string().trim().max(40).optional(),
});

export const testimonialsDataSchema = z.object({
  heading: z.string().trim().max(80).optional(),
  items: z.array(testimonialItemSchema).min(1).max(12),
});

export const BEFORE_AFTER_LAYOUTS = ["side_by_side", "stacked"] as const;
export type BeforeAfterLayout = (typeof BEFORE_AFTER_LAYOUTS)[number];

/**
 * Bloque comparador "Antes / Después": una imagen con divisor deslizable
 * (mouse/touch/teclado) superpuesta sobre otra. `before_description`,
 * `after_description` y `layout` quedan solo por compatibilidad con datos
 * antiguos del diseño previo de 2 columnas — el editor y el render actuales
 * ya no los usan.
 */
export const beforeAfterDataSchema = z.object({
  heading: z.string().trim().max(80).optional(),

  before_title: z.string().trim().max(80).optional(),
  before_description: z.string().trim().max(600).optional(),
  before_image_url: z.string().url().or(z.literal("")).optional(),

  after_title: z.string().trim().max(80).optional(),
  after_description: z.string().trim().max(600).optional(),
  after_image_url: z.string().url().or(z.literal("")).optional(),

  layout: z.enum(BEFORE_AFTER_LAYOUTS).default("side_by_side"),
});

/**
 * Bloque "Secuencia visual": creativos verticales donde el titular y el copy
 * ya están integrados en la propia imagen. El mantenedor solo sube, ordena y
 * activa/desactiva — no hay campos de texto por lámina aparte de `alt`.
 */
export const visualSlideSchema = z.object({
  image_url: z.string().url(),
  alt: z.string().trim().max(180).optional(),
});

export const visualSequenceDataSchema = z.object({
  slides: z.array(visualSlideSchema).max(12).default([]),
});

/**
 * Bloque "Packs y ahorro": presenta un SUBCONJUNTO de los escalones reales de
 * `products.discount_steps` (lib/discounts.ts) como tarjetas seleccionables.
 * Nunca inventa un precio o porcentaje — `minQty` es una referencia al
 * escalón real; si ese escalón ya no existe (el admin lo borró en la sección
 * de descuentos por volumen), la tarjeta simplemente no se muestra en el
 * storefront (ver lib/product/sections/quantityPacks.ts).
 */
export const quantityPackStepRefSchema = z.object({
  /** Referencia a `discount_steps[].minQty` — no un precio ni porcentaje propio. */
  minQty: z.number().int().min(2),
  /** Nombre visible del pack (ej. "Pack Dúo"). Si se omite, la UI usa "x{minQty}". */
  label: z.string().trim().max(40).optional(),
});

export const quantityPacksDataSchema = z.object({
  heading: z.string().trim().max(80).optional(),
  description: z.string().trim().max(240).optional(),
  steps: z.array(quantityPackStepRefSchema).min(1).max(6),
  /**
   * `minQty` del escalón marcado como "Más elegido" por el admin, o `null` si
   * ninguno — nunca se infiere ni se calcula automáticamente.
   */
  mostChosenMinQty: z.number().int().min(2).nullable().default(null),
});

/**
 * Bloque "Contador de oferta": cuenta regresiva real hacia una fecha/hora que
 * el admin define explícitamente. Sin fecha, con fecha inválida o ya pasada,
 * el bloque no se renderiza (ver lib/product/sections/offerCountdown.ts) —
 * nunca un temporizador que se reinicia solo ni una fecha inventada.
 */
export const offerCountdownDataSchema = z.object({
  heading: z.string().trim().max(80).optional(),
  message: z.string().trim().max(140).optional(),
  /** ISO 8601 (con offset) de término. Vacío = bloque sin fecha configurada (no se renderiza). */
  ends_at: z.string().trim().optional().default(""),
});

// ─── Base + discriminated union ──────────────────────────────────────────────

export const sectionBaseSchema = z.object({
  id: z.string().min(1).max(64),
  enabled: z.boolean(),
  order: z.number().int().min(0),
});

export const sectionSchema = z.discriminatedUnion("type", [
  sectionBaseSchema.extend({
    type: z.literal("benefits"),
    data: benefitsDataSchema,
  }),
  sectionBaseSchema.extend({
    type: z.literal("media_strip"),
    data: mediaStripDataSchema,
  }),
  sectionBaseSchema.extend({
    type: z.literal("faq"),
    data: faqDataSchema,
  }),
  sectionBaseSchema.extend({
    type: z.literal("testimonials"),
    data: testimonialsDataSchema,
  }),
  sectionBaseSchema.extend({
    type: z.literal("before_after"),
    data: beforeAfterDataSchema,
  }),
  sectionBaseSchema.extend({
    type: z.literal("visual_sequence"),
    data: visualSequenceDataSchema,
  }),
  sectionBaseSchema.extend({
    type: z.literal("usage"),
    data: usageDataSchema,
  }),
  sectionBaseSchema.extend({
    type: z.literal("measurements"),
    data: measurementsDataSchema,
  }),
  sectionBaseSchema.extend({
    type: z.literal("versatility"),
    data: versatilityDataSchema,
  }),
  sectionBaseSchema.extend({
    type: z.literal("quantity_packs"),
    data: quantityPacksDataSchema,
  }),
  sectionBaseSchema.extend({
    type: z.literal("offer_countdown"),
    data: offerCountdownDataSchema,
  }),
]);

export const productSectionsSchema = z.array(sectionSchema).max(20);

// ─── Tipos derivados ─────────────────────────────────────────────────────────

export type BenefitItem = z.infer<typeof benefitItemSchema>;
export type BenefitsData = z.infer<typeof benefitsDataSchema>;
export type MediaStripData = z.infer<typeof mediaStripDataSchema>;
export type FaqItem = z.infer<typeof faqItemSchema>;
export type FaqData = z.infer<typeof faqDataSchema>;
export type TestimonialItem = z.infer<typeof testimonialItemSchema>;
export type TestimonialsData = z.infer<typeof testimonialsDataSchema>;
export type BeforeAfterData = z.infer<typeof beforeAfterDataSchema>;
export type VisualSlide = z.infer<typeof visualSlideSchema>;
export type VisualSequenceData = z.infer<typeof visualSequenceDataSchema>;
export type UsageData = z.infer<typeof usageDataSchema>;
export type MeasurementsData = z.infer<typeof measurementsDataSchema>;
export type VersatilityData = z.infer<typeof versatilityDataSchema>;
export type QuantityPackStepRef = z.infer<typeof quantityPackStepRefSchema>;
export type QuantityPacksData = z.infer<typeof quantityPacksDataSchema>;
export type OfferCountdownData = z.infer<typeof offerCountdownDataSchema>;
export type ProductSection = z.infer<typeof sectionSchema>;
export type ProductSectionList = z.infer<typeof productSectionsSchema>;
export type ProductSectionType = ProductSection["type"];

// ─── Registry para el admin builder ──────────────────────────────────────────
// Orden = orden en el menú "Agregar bloque". Los 3 primeros son el flujo
// recomendado (image-first) para productos nuevos; el resto se mantiene solo
// por compatibilidad con productos que ya los usan.

export const SECTION_REGISTRY: {
  type: ProductSectionType;
  label: string;
  description: string;
}[] = [
  {
    type: "benefits",
    label: "Beneficios",
    description: "Imagen principal opcional + 3–6 tarjetas con icono, título y subtítulo.",
  },
  {
    type: "usage",
    label: "Uso / Cómo usar",
    description: "Una imagen principal que explica cómo se usa el producto.",
  },
  {
    type: "measurements",
    label: "Medidas",
    description: "Una imagen principal con las medidas o dimensiones del producto.",
  },
  {
    type: "versatility",
    label: "Versatilidad",
    description: "Una imagen principal mostrando los distintos usos del producto.",
  },
  {
    type: "visual_sequence",
    label: "Secuencia visual",
    description: "Creativos verticales con titular y copy ya integrados en la imagen.",
  },
  {
    type: "before_after",
    label: "Comparador antes/después",
    description: "Divisor deslizable entre dos imágenes elegidas de la biblioteca.",
  },
  {
    type: "faq",
    label: "Preguntas frecuentes",
    description: "Acordeón de preguntas frecuentes.",
  },
  {
    type: "media_strip",
    label: "Imagen ancha",
    description: "Una imagen full-width con leyenda opcional.",
  },
  {
    type: "testimonials",
    label: "Testimonios",
    description: "Tarjetas curadas con foto, nombre y comentario.",
  },
  {
    type: "quantity_packs",
    label: "Packs y ahorro",
    description:
      "Tarjetas seleccionables con los escalones reales de descuento por cantidad. Requiere tener descuentos por volumen configurados.",
  },
  {
    type: "offer_countdown",
    label: "Contador de oferta",
    description: "Cuenta regresiva real hacia una fecha/hora que tú defines. Sin fecha configurada, no se muestra.",
  },
];
