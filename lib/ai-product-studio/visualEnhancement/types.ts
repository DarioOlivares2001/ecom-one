/**
 * Máximo de imágenes IA que se pueden generar por ficha (por sesión del
 * asistente) — defensa reforzada server-side (`generate-image/route.ts`)
 * además del límite ya aplicado en la UI. Vive acá (no en `openaiConfig.ts`,
 * que es `"server-only"`) porque el panel cliente del Nivel 3 también lo
 * necesita para deshabilitar el botón "Generar imagen".
 */
export const AI_PRODUCT_STUDIO_MAX_IMAGES_PER_DRAFT = 3;

/**
 * Límite del prompt visual (editable a mano por el admin antes de generar) —
 * mismo valor que validan `generate-image/route.ts` y `approve-image/route.ts`
 * en servidor. Es "texto largo" a propósito (nunca comparte el límite corto
 * de 240 de un campo secundario como un encabezado): un prompt de generación
 * puede necesitar instrucciones detalladas de composición/contexto.
 */
export const AI_PRODUCT_STUDIO_MAX_PROMPT_LENGTH = 1200;

/**
 * Nivel 3 del Estudio IA de Producto — "Mejora visual y persuasiva de la
 * ficha" / "Dirección visual de ficha". Vive enteramente dentro de
 * `/admin/productos/crear-con-ia`, DESPUÉS del borrador textual y ANTES de
 * aplicar/guardar el producto. No es el módulo global de creativos/marketing
 * (fuera de alcance a propósito).
 *
 * Las propuestas de qué imagen usar (o generar) por sección viven en
 * `imageDirectionPlan.ts` (`SectionImagePlan.generationProposal`). Este
 * archivo define solo lo que pasa DESPUÉS de que el admin decide generar una
 * imagen concreta para una sección:
 *  1. `AIImageGenerationRequest` — lo que se envía al servidor para generar
 *     UNA imagen (identificada por `sectionId`, único por plan — cada
 *     sección tiene como máximo una propuesta de generación a la vez).
 *  2. `PendingAIImage`  — imagen ya generada, en memoria del navegador, SIN
 *     subir a R2 todavía.
 *  3. `ApprovedAIImage` — imagen ya subida a R2 tras aprobación explícita
 *     del admin.
 *
 * Fotos reales del proveedor y fotos generadas por IA nunca se mezclan
 * automáticamente: una `ApprovedAIImage` solo entra a `product_media`/la
 * galería pública mediante una acción explícita del admin en el asistente.
 */

export interface AIImageGenerationRequest {
  /** Id real de `productSections[].id`, o el literal "gallery" — único dentro de un mismo plan. */
  sectionId: string;
  sectionType: string;
  /** Prompt final (puede haber sido editado a mano por el admin sobre `promptDraft`). */
  prompt: string;
  /** Foto real del proveedor a usar como base de la edición — obligatoria, nunca inventada. */
  referenceImageUrl: string;
}

export interface PendingAIImage {
  /** Id local, solo para React keys / tracking en memoria — no persiste. */
  id: string;
  sectionId: string;
  sectionType: string;
  prompt: string;
  referenceImageUrl: string;
  /** `data:image/...;base64,...` — vive solo en memoria del navegador hasta aprobar. */
  dataUrl: string;
  createdAt: string;
}

export interface ApprovedAIImage {
  /** URL pública final en R2. */
  url: string;
  sectionId: string;
  sectionType: string;
  prompt: string;
  referenceImageUrl: string;
  createdAt: string;
}
