import { z } from "zod";

/**
 * Máximo de imágenes IA que se pueden generar por ficha (por sesión del
 * asistente) — defensa reforzada server-side (`generate-image/route.ts`)
 * además del límite ya aplicado en la UI. Vive acá (no en `openaiConfig.ts`,
 * que es `"server-only"`) porque el panel cliente del Nivel 3 también lo
 * necesita para deshabilitar el botón "Generar imagen".
 */
export const AI_PRODUCT_STUDIO_MAX_IMAGES_PER_DRAFT = 3;

/**
 * Nivel 3 del Estudio IA de Producto — "Mejora visual y persuasiva de la
 * ficha". Vive enteramente dentro de `/admin/productos/crear-con-ia`, DESPUÉS
 * del borrador textual y ANTES de aplicar/guardar el producto. No es el
 * módulo global de creativos/marketing (fuera de alcance a propósito).
 *
 * Cuatro tipos separados, tal como pide el contrato:
 *  1. `VisualSuggestion`   — propuesta de la auditoría (qué hacer, nunca genera nada todavía).
 *  2. `AIImageGenerationRequest` — lo que se envía al servidor para generar UNA imagen.
 *  3. `PendingAIImage`     — imagen ya generada, en memoria del navegador, SIN subir a R2 todavía.
 *  4. `ApprovedAIImage`    — imagen ya subida a R2 tras aprobación explícita del admin.
 *
 * Fotos reales del proveedor y fotos generadas por IA nunca se mezclan
 * automáticamente: una `ApprovedAIImage` solo entra a `product_media`/la
 * galería pública mediante una acción explícita del admin en el asistente.
 */

// ─── 1. Sugerencia visual (auditoría) ─────────────────────────────────────────

export const VISUAL_SUGGESTION_ACTIONS = [
  "use_supplier_photo",
  "suggest_lifestyle",
  "suggest_usage",
  "suggest_context",
  "no_image_needed",
] as const;
export type VisualSuggestionAction = (typeof VISUAL_SUGGESTION_ACTIONS)[number];

export const VISUAL_SUGGESTION_ACTION_LABELS: Record<VisualSuggestionAction, string> = {
  use_supplier_photo: "Usar foto del proveedor",
  suggest_lifestyle: "Sugerir imagen lifestyle",
  suggest_usage: "Sugerir imagen de uso",
  suggest_context: "Sugerir imagen de contexto",
  no_image_needed: "No necesita imagen adicional",
};

/** Acciones que SÍ implican generar una imagen nueva (tienen `promptDraft`). */
export const GENERATIVE_VISUAL_ACTIONS = new Set<VisualSuggestionAction>([
  "suggest_lifestyle",
  "suggest_usage",
  "suggest_context",
]);

export const visualSuggestionSchema = z.object({
  /** Id estable dentro de esta auditoría (no persiste entre generaciones). */
  id: z.string().min(1),
  /** Id real de `productSections[].id`, o el literal "gallery" para la portada/galería. */
  sectionId: z.string().min(1),
  /** Tipo de bloque real, o "gallery" — para poder aplicar reglas duras (ej. medidas nunca genera). */
  sectionType: z.string().min(1),
  /** Etiqueta humana para mostrar en la UI (ej. "Medidas", "Galería principal"). */
  sectionLabel: z.string().min(1),
  action: z.enum(VISUAL_SUGGESTION_ACTIONS),
  /** Qué busca lograr esta sugerencia comercialmente (breve, una frase). */
  persuasiveGoal: z.string(),
  /** Foto REAL del proveedor que se usará como referencia — nunca inventada, siempre de la selección del admin. */
  referenceImageUrl: z.string().url().nullable(),
  /** Prompt editable para generar la imagen — null si la acción no genera nada. */
  promptDraft: z.string().nullable(),
  /** Riesgos/datos que la imagen NUNCA debe afirmar (medidas, capacidad, certificaciones, etc.). */
  risks: z.array(z.string()),
});
export type VisualSuggestion = z.infer<typeof visualSuggestionSchema>;

export const visualAuditSchema = z.object({
  suggestions: z.array(visualSuggestionSchema).max(12),
  generatedAt: z.string(),
  /** Avisos deterministas del servidor (ej. "se forzó no_image_needed en Medidas"). */
  warnings: z.array(z.string()).default([]),
});
export type VisualAudit = z.infer<typeof visualAuditSchema>;

// ─── 2. Solicitud de generación ────────────────────────────────────────────────

export interface AIImageGenerationRequest {
  suggestionId: string;
  sectionId: string;
  sectionType: string;
  /** Prompt final (puede haber sido editado a mano por el admin sobre `promptDraft`). */
  prompt: string;
  /** Foto real del proveedor a usar como base de la edición — obligatoria, nunca inventada. */
  referenceImageUrl: string;
}

// ─── 3. Imagen generada, pendiente de aprobación (nunca en R2 todavía) ────────

export interface PendingAIImage {
  /** Id local, solo para React keys / tracking en memoria — no persiste. */
  id: string;
  suggestionId: string;
  sectionId: string;
  sectionType: string;
  prompt: string;
  referenceImageUrl: string;
  /** `data:image/...;base64,...` — vive solo en memoria del navegador hasta aprobar. */
  dataUrl: string;
  createdAt: string;
}

// ─── 4. Imagen aprobada (ya subida a R2) ───────────────────────────────────────

export interface ApprovedAIImage {
  /** URL pública final en R2. */
  url: string;
  suggestionId: string;
  sectionId: string;
  sectionType: string;
  prompt: string;
  referenceImageUrl: string;
  createdAt: string;
}
