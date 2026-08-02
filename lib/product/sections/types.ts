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
  items: z.array(benefitItemSchema).min(1).max(6),
});

export const mediaStripDataSchema = z.object({
  image_url: z.string().url().or(z.literal("")).default(""),
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
 * Bloque comparativo "Antes / Después".
 *
 * Pensado para limpieza, olores, organización, etc. Cada lado es enteramente
 * opcional (texto e imagen), pero al renderizar debe existir al menos un lado
 * con algún contenido — el renderer público filtra el caso vacío.
 *
 * `before_description` y `after_description` aceptan saltos de línea (renderer
 * usa `whitespace-pre-line`) para soportar listas tipo:
 *   ❌ malos olores
 *   ❌ arena en el piso
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
export type ProductSection = z.infer<typeof sectionSchema>;
export type ProductSectionList = z.infer<typeof productSectionsSchema>;
export type ProductSectionType = ProductSection["type"];

// ─── Registry para el admin builder ──────────────────────────────────────────

export const SECTION_REGISTRY: {
  type: ProductSectionType;
  label: string;
  description: string;
}[] = [
  {
    type: "benefits",
    label: "Beneficios",
    description: "3–6 tarjetas con icono, título y subtítulo.",
  },
  {
    type: "media_strip",
    label: "Imagen ancha",
    description: "Una imagen full-width con leyenda opcional.",
  },
  {
    type: "faq",
    label: "Preguntas",
    description: "Acordeón de preguntas frecuentes.",
  },
  {
    type: "testimonials",
    label: "Testimonios",
    description: "Tarjetas curadas con foto, nombre y comentario.",
  },
  {
    type: "before_after",
    label: "Antes / Después",
    description: "Comparativa visual antes vs. después (limpieza, olores, etc.).",
  },
];
