import { z } from "zod";
import { productSectionsSchema } from "@/lib/product/sections/types";

/**
 * Estudio IA de Producto — Fase 1 (base local, sin proveedor externo).
 *
 * Contrato de entrada/salida del "borrador" que genera el estudio. La salida
 * (`aiProductDraftSchema`) usa exactamente los mismos tipos que ya persiste
 * `products`:
 *  - `images`      → mismo formato que `products.images` (array de URLs
 *    públicas ya subidas, orden = orden de galería, portada = primera).
 *  - `product_sections` → reusa `productSectionsSchema` de
 *    `lib/product/sections/types.ts` sin redefinirlo, así que cualquier
 *    borrador válido acá es, por construcción, un `product_sections` válido
 *    para guardar en la base — no hay dos formatos que puedan divergir.
 *  - El resto de los campos (`name`, `slug`, `description`, `category`,
 *    `meta_title`, `meta_desc`, `tags`) son texto plano/HTML simple, mismo
 *    tipo que las columnas homónimas de `products`.
 *
 * Esta fase NO llama a ningún proveedor de IA — ver `generateDemoDraft.ts`
 * para el generador local determinista, y `AI_PRODUCT_STUDIO_PLAN.md` para
 * el diseño de la integración real futura.
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

export const aiProductStudioInputSchema = z.object({
  /** Texto/ficha tal como lo entrega el proveedor — la única fuente de hechos del producto. */
  supplierText: z.string().trim().min(1, "Pega el texto o ficha del proveedor."),
  /** URLs elegidas desde `product_media` (biblioteca ya subida) — nunca se suben imágenes nuevas acá. */
  selectedImages: z.array(z.string().url()).min(1, "Selecciona al menos una imagen de la biblioteca."),
  /** Objetivo comercial libre y opcional (ej. "aumentar conversión en mobile"). Solo orienta tono/énfasis, nunca inventa datos. */
  commercialGoal: z.string().trim().max(240).optional(),
  tone: z.enum(AI_PRODUCT_STUDIO_TONES),
});
export type AIProductStudioInput = z.infer<typeof aiProductStudioInputSchema>;

// ─── Salida del estudio (borrador) ────────────────────────────────────────────

/** Texto simple, recortado. Vacío es válido: significa "sin datos suficientes", nunca se rellena inventando. */
const draftTextSchema = z.string().trim();

export const aiProductDraftSchema = z.object({
  /** Igual forma que `products.name`. Vacío si el texto de origen no trae un nombre reconocible. */
  name: draftTextSchema,
  /** Igual forma que `products.slug`. Derivado de `name`; vacío si `name` está vacío. */
  slug: draftTextSchema,
  /** HTML simple (párrafos), igual forma que `products.description`. */
  description: draftTextSchema,
  /** Igual forma que `products.meta_title`. Aún sin campo en el formulario admin — ver AI_PRODUCT_STUDIO_PLAN.md. */
  meta_title: draftTextSchema.max(70).optional(),
  /** Igual forma que `products.meta_desc`. */
  meta_desc: draftTextSchema.max(160).optional(),
  /** Igual forma que `products.category`. El generador demo nunca la infiere (evita adivinar un rubro). */
  category: draftTextSchema.optional(),
  /** Igual forma que `products.tags`. El generador demo siempre la deja vacía (evita inventar palabras clave). */
  tags: z.array(z.string().trim().min(1)).max(10).default([]),
  /** Igual forma que `products.images`: subconjunto ordenado de `selectedImages`, primera = portada. */
  images: z.array(z.string().url()),
  /** Mismo schema que ya valida el editor real de bloques — compatibilidad garantizada por construcción. */
  product_sections: productSectionsSchema,
  /** Metadatos propios del estudio — nunca se guardan en `products`, solo informan la UI/el informe. */
  meta: z.object({
    mode: z.literal("demo"),
    /** ISO 8601. Se pasa como parámetro al generador para que siga siendo puro/determinista. */
    generatedAt: z.string(),
    /** Explican qué se omitió y por qué (ej. "Sin menciones de materiales: se dejó vacío"). */
    warnings: z.array(z.string()).default([]),
    /** Nombres de campos marcados "por confirmar" por falta de información en el texto de origen. */
    pendingFields: z.array(z.string()).default([]),
  }),
});
export type AIProductDraft = z.infer<typeof aiProductDraftSchema>;
