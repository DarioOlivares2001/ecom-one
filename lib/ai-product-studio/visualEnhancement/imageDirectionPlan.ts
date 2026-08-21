/**
 * "Dirección visual de ficha" — reemplaza la auditoría plana del Nivel 3
 * anterior (`generateVisualAudit.ts`, retirado) después de que una prueba
 * real (un taladro) mostró que sin clasificar las imágenes primero, la IA
 * podía elegir como portada una gráfica promocional con texto y repetirla
 * en varias secciones. Este módulo separa el problema en tres pasos
 * explícitos: clasificar cada foto real, curar/ordenar la galería con esa
 * clasificación, y asignar como máximo UNA imagen (real o generada) por
 * sección, sin repetir ninguna.
 */

// ─── Clasificación de imágenes ─────────────────────────────────────────────

export const IMAGE_CATEGORIES = [
  "clean_cover",
  "in_use",
  "kit_accessories",
  "detail",
  "measurements",
  "promotional_graphic",
  "collage",
  "low_quality",
] as const;
export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];

export const IMAGE_CATEGORY_LABELS: Record<ImageCategory, string> = {
  clean_cover: "Portada limpia",
  in_use: "Producto en uso",
  kit_accessories: "Kit / accesorios",
  detail: "Detalle",
  measurements: "Medidas técnicas",
  promotional_graphic: "Gráfica promocional / texto",
  collage: "Collage",
  low_quality: "Baja calidad / no recomendada",
};

/**
 * Únicas categorías aptas para portada — regla dura aplicada en servidor,
 * nunca una excepción aunque el modelo insista en otra cosa (esto es
 * literalmente lo que falló con el taladro: una "promotional_graphic" no
 * puede volver a quedar de portada).
 */
export const COVER_ELIGIBLE_CATEGORIES = new Set<ImageCategory>(["clean_cover", "in_use"]);

/**
 * Categorías que nunca entran a la galería recomendada ni a ninguna sección
 * de la ficha pública por defecto. "measurements" es la única que además
 * tiene un destino propio (el bloque Medidas, y solo ese).
 */
export const GALLERY_EXCLUDED_CATEGORIES = new Set<ImageCategory>([
  "measurements",
  "promotional_graphic",
  "collage",
  "low_quality",
]);

export interface ImageClassification {
  url: string;
  category: ImageCategory;
  /** Motivo editorial breve, visible en la UI (ej. "Texto grande 'Design leve' cubre el producto"). */
  reason: string;
}

// ─── Propuestas de generación (mismo mecanismo de aprobación del Nivel 3) ──

export const GENERATION_INTENTS = ["product_in_use", "lifestyle_context", "functional_detail", "organized_kit"] as const;
export type GenerationIntent = (typeof GENERATION_INTENTS)[number];

export const GENERATION_INTENT_LABELS: Record<GenerationIntent, string> = {
  product_in_use: "Producto en uso",
  lifestyle_context: "Contexto/lifestyle",
  functional_detail: "Detalle funcional",
  organized_kit: "Kit organizado",
};

export interface GenerationProposal {
  intent: GenerationIntent;
  persuasiveGoal: string;
  /** Foto REAL del proveedor a usar como base de la edición — nunca inventada. */
  referenceImageUrl: string;
  promptDraft: string;
  risks: string[];
}

// ─── Plan por sección ───────────────────────────────────────────────────────

export interface SectionImagePlan {
  /** Id real de `productSections[].id`, o el literal "gallery" para portada/galería principal. */
  sectionId: string;
  /** Tipo real del bloque, o "gallery" — permite aplicar reglas duras (ej. medidas nunca genera). */
  sectionType: string;
  sectionLabel: string;
  assignedImageUrl: string | null;
  assignmentReason: string | null;
  /** true si esta sección no tiene una imagen adecuada asignada — la UI muestra "Esta sección necesita un recurso visual complementario". */
  needsGeneration: boolean;
  generationProposal: GenerationProposal | null;
}

// ─── Plan de galería ────────────────────────────────────────────────────────

export interface GalleryPlan {
  /** Orden recomendado — portada primero si existe. Nunca incluye imágenes de `GALLERY_EXCLUDED_CATEGORIES`. */
  recommendedOrder: string[];
  coverUrl: string | null;
  /** null cuando `coverUrl` es null — "Portada por confirmar", nunca una explicación inventada para una portada que no se eligió. */
  coverReason: string | null;
  discarded: { url: string; category: ImageCategory; reason: string }[];
}

// ─── Plan completo ──────────────────────────────────────────────────────────

export interface VisualDirectionPlan {
  classifications: ImageClassification[];
  gallery: GalleryPlan;
  sections: SectionImagePlan[];
  generatedAt: string;
  warnings: string[];
}
