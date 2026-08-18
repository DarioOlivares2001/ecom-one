import { z } from "zod";
import { productSectionsSchema } from "@/lib/product/sections/types";

/**
 * Estudio IA de Producto — contrato de entrada/salida.
 *
 * Fase 1 (`generateDemoDraft.ts`) y Fase 2 (`generateAIDraft.ts`, OpenAI real)
 * producen el MISMO `AIProductDraft` — solo cambia `meta.mode` ("demo" vs
 * "ai") y quién generó el contenido. La salida usa exactamente los mismos
 * tipos que ya persiste `products`:
 *  - `galleryImageUrls` → mismo formato que `products.images` (array de URLs
 *    públicas ya subidas, orden = orden de galería, portada = primera).
 *  - `productSections`  → reusa `productSectionsSchema` de
 *    `lib/product/sections/types.ts` sin redefinirlo, así que cualquier
 *    borrador válido acá es, por construcción, un `product_sections` válido
 *    para guardar en la base — no hay dos formatos que puedan divergir.
 *  - `name`/`slug`/`category`/`tags`/`descriptionHtml` son texto plano/HTML
 *    simple, mismo tipo que las columnas homónimas de `products`.
 */

// ─── Entrada del estudio ──────────────────────────────────────────────────────

export const AI_PRODUCT_STUDIO_TONES = ["directo", "confiable", "premium", "practico"] as const;
export type AIProductStudioTone = (typeof AI_PRODUCT_STUDIO_TONES)[number];

export const AI_PRODUCT_STUDIO_TONE_LABELS: Record<AIProductStudioTone, string> = {
  directo: "Directo",
  confiable: "Confiable",
  premium: "Premium",
  practico: "Práctico",
};

export const MAX_SUPPLIER_TEXT_LENGTH = 6000;
export const MAX_SELECTED_IMAGES = 6;

export const aiProductStudioInputSchema = z.object({
  /** Texto/ficha tal como lo entrega el proveedor — la única fuente de hechos del producto. */
  supplierText: z.string().trim().min(1, "Pega el texto o ficha del proveedor.").max(MAX_SUPPLIER_TEXT_LENGTH, "El texto del proveedor es demasiado largo."),
  /** URLs elegidas desde `product_media` (biblioteca ya subida) — nunca se suben imágenes nuevas acá. */
  selectedImages: z
    .array(z.string().url())
    .min(1, "Selecciona al menos una imagen de la biblioteca.")
    .max(MAX_SELECTED_IMAGES, `Selecciona como máximo ${MAX_SELECTED_IMAGES} imágenes.`),
  /** Instrucción comercial libre y opcional (ej. "enfócalo en espacios pequeños"). Solo orienta tono/énfasis, nunca inventa datos. */
  commercialGoal: z.string().trim().max(240).optional(),
  tone: z.enum(AI_PRODUCT_STUDIO_TONES),
});
export type AIProductStudioInput = z.infer<typeof aiProductStudioInputSchema>;

// ─── Salida del estudio (borrador) ────────────────────────────────────────────

export const AI_PRODUCT_STUDIO_MODES = ["demo", "ai"] as const;
export type AIProductStudioMode = (typeof AI_PRODUCT_STUDIO_MODES)[number];

export const DETECTED_FACT_SOURCES = ["supplier_text", "image_visual"] as const;
export type DetectedFactSource = (typeof DETECTED_FACT_SOURCES)[number];

export const detectedFactSchema = z.object({
  claim: z.string().trim().min(1),
  source: z.enum(DETECTED_FACT_SOURCES),
});
export type DetectedFact = z.infer<typeof detectedFactSchema>;

/** Texto simple, recortado. Vacío es válido: significa "sin datos suficientes", nunca se rellena inventando. */
const draftTextSchema = z.string().trim();

export const aiProductDraftSchema = z.object({
  /** Igual forma que `products.name`. "Nombre por confirmar" si el texto/imágenes no traen un nombre reconocible. */
  name: draftTextSchema,
  /** Igual forma que `products.slug`. SIEMPRE normalizado/derivado en servidor desde `name` — nunca se confía en lo que proponga el modelo. */
  slug: draftTextSchema,
  /** Igual forma que `products.category`. Vacía si no hay evidencia suficiente para elegir un rubro. */
  category: draftTextSchema.default(""),
  /** Igual forma que `products.tags`. */
  tags: z.array(z.string().trim().min(1)).max(10).default([]),
  /** HTML simple (párrafos), igual forma que `products.description`. */
  descriptionHtml: draftTextSchema,
  /** Mismo schema que ya valida el editor real de bloques — compatibilidad garantizada por construcción. */
  productSections: productSectionsSchema,
  /** Igual forma que `products.images`: subconjunto ordenado de las imágenes seleccionadas por el admin, primera = portada. Nunca una URL fuera de esa selección. */
  galleryImageUrls: z.array(z.string().url()),
  /** Hechos literales detectados, cada uno con su fuente de evidencia (texto o imagen). */
  detectedFacts: z.array(detectedFactSchema).default([]),
  /** Afirmaciones que NO deben hacerse por falta de evidencia (o que se detectaron y removieron del borrador). */
  claimsToAvoid: z.array(z.string()).default([]),
  /** Nombres de campo que quedan "por confirmar" por falta de información. */
  fieldsNeedingConfirmation: z.array(z.string()).default([]),
  /** Líneas del texto de origen descartadas a propósito (contacto, stock, ofertas, despacho, URLs, administrativo, garantías ajenas). */
  ignoredSupplierLines: z.array(z.string()).default([]),
  /** Metadatos propios del estudio — nunca se guardan en `products`, solo informan la UI/el informe. */
  meta: z.object({
    mode: z.enum(AI_PRODUCT_STUDIO_MODES),
    /** ISO 8601. */
    generatedAt: z.string(),
    /** Modelo de OpenAI usado (solo cuando mode === "ai"). */
    model: z.string().optional(),
    warnings: z.array(z.string()).default([]),
  }),
});
export type AIProductDraft = z.infer<typeof aiProductDraftSchema>;
