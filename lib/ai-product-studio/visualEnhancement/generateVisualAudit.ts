import "server-only";

import { z } from "zod";
import OpenAI, { APIConnectionTimeoutError, APIError } from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import type { AIProductDraft } from "../schema";
import { getAIProductStudioModel, getOpenAIApiKey, isAIProductStudioEnabled } from "../openaiConfig";
import {
  GENERATIVE_VISUAL_ACTIONS,
  VISUAL_SUGGESTION_ACTIONS,
  VISUAL_SUGGESTION_ACTION_LABELS,
  visualAuditSchema,
  type VisualAudit,
  type VisualSuggestion,
  type VisualSuggestionAction,
} from "./types";

const REQUEST_TIMEOUT_MS = 45_000;
const MAX_SUGGESTIONS = 12;

/** Mismo tipo de cliente inyectable que `generateAIDraft.ts` (solo usa `responses.create`) — permite mockear en tests sin tocar OpenAI real. */
export interface VisualAuditOpenAIClient {
  responses: {
    create: (params: Record<string, unknown>, options?: { timeout?: number }) => Promise<{ output_text?: string }>;
  };
}

const aiModelVisualSuggestionSchema = z.object({
  /** Índice dentro de la lista de secciones anunciada en el prompt (0 = galería principal). */
  sectionIndex: z.number().int(),
  action: z.enum(VISUAL_SUGGESTION_ACTIONS),
  persuasiveGoal: z.string().max(200),
  /** ID simbólico (image_1, image_2...) de una foto REAL entregada — nunca una URL, nunca inventado. */
  referenceImageId: z.string().nullable(),
  promptDraft: z.string().max(600),
  risks: z.array(z.string().max(200)).max(6),
});

const aiModelVisualAuditOutputSchema = z.object({
  suggestions: z.array(aiModelVisualSuggestionSchema).max(MAX_SUGGESTIONS),
});
type AIModelVisualAuditOutput = z.infer<typeof aiModelVisualAuditOutputSchema>;

const SYSTEM_PROMPT = `Eres el auditor visual del "Estudio IA de Producto" de una tienda online chilena. Ya existe un borrador de ficha (nombre, descripción, bloques). Tu única tarea ahora es proponer, para cada sección existente y para la galería principal, qué hacer con las imágenes — NUNCA generas ni describes contenido nuevo del producto, solo propones un plan visual que un administrador humano revisará antes de generar nada.

Reglas obligatorias, sin excepción:

1. Las fotos del proveedor que se te muestran (image_1, image_2...) son la ÚNICA referencia de verdad del producto real. Nunca propongas un prompt que cambie su forma, controles, piezas, marca, proporciones, color real o materiales — el prompt debe pedir SOLO cambios de entorno, fondo, iluminación, composición o contexto de uso, manteniendo el producto exactamente como se ve en la foto de referencia.
2. Nunca inventes ni sugieras afirmar en una imagen: especificaciones técnicas, accesorios que no aparecen en las fotos, colores o tamaños no confirmados, materiales, certificaciones, resultados de uso, o usos no respaldados por el texto/fotos ya analizados. Cualquier duda de este tipo va en "risks", nunca se resuelve inventando.
3. La sección de tipo "measurements" (Medidas) NUNCA recibe una acción "suggest_lifestyle", "suggest_usage" ni "suggest_context" — una imagen generada no puede aportar cifras nuevas ni confirmarlas. Para esa sección solo puedes proponer "use_supplier_photo" (si ya hay una foto real de referencia con las cotas) o "no_image_needed".
4. Cada acción "suggest_lifestyle" / "suggest_usage" / "suggest_context" DEBE traer un "referenceImageId" válido (una de las fotos reales entregadas) — nunca propongas generar una imagen sin foto de referencia real. Si ninguna foto sirve de base fiel, usa "no_image_needed" en vez de forzar una referencia que no corresponde.
5. "promptDraft" debe estar vacío ("") para las acciones "use_supplier_photo" y "no_image_needed" — esas acciones no generan nada.
6. Sé selectivo: no todas las secciones necesitan una imagen adicional. Si una sección ya comunica bien lo que debe con su foto actual, usa "use_supplier_photo" o "no_image_needed" en vez de forzar una sugerencia.
7. "persuasiveGoal" es una frase breve y concreta (ej. "mostrar el producto en uso real, en una cocina pequeña, para transmitir practicidad diaria"), nunca una promesa de resultado no verificable.
8. "risks" lista, en español simple, qué datos o afirmaciones NO debe mostrar/sugerir la imagen resultante (ej. "no mostrar niveles de molienda ni capacidad en gramos", "no alterar el color real del plástico").

Responde únicamente con el JSON estructurado solicitado.`;

function buildUserPrompt(input: {
  sections: { index: number; type: string; label: string; hasImage: boolean }[];
  imageIds: string[];
}): string {
  const sectionLines = input.sections
    .map((s) => `${s.index}. [${s.type}] ${s.label}${s.hasImage ? " (ya tiene una imagen asignada)" : " (sin imagen todavía)"}`)
    .join("\n");
  return [
    "Secciones actuales de la ficha (usa el número exacto como sectionIndex):",
    sectionLines,
    "",
    input.imageIds.length > 0
      ? `Fotos reales del proveedor entregadas, en este orden: ${input.imageIds.join(", ")}. Para "referenceImageId" responde solo con uno de estos IDs exactos, o null.`
      : "No se entregaron fotos reales adicionales para este análisis.",
  ].join("\n");
}

export type GenerateVisualAuditErrorCode = "disabled" | "not_configured" | "timeout" | "api_error" | "invalid_response";

export type GenerateVisualAuditResult =
  | { ok: true; audit: VisualAudit }
  | { ok: false; code: GenerateVisualAuditErrorCode; error: string };

let cachedClient: VisualAuditOpenAIClient | null = null;
function getDefaultClient(): VisualAuditOpenAIClient {
  if (cachedClient) return cachedClient;
  cachedClient = new OpenAI({ apiKey: getOpenAIApiKey() }) as unknown as VisualAuditOpenAIClient;
  return cachedClient;
}

function sectionLabelFor(type: string, heading: string | undefined): string {
  const base =
    type === "benefits"
      ? "Beneficios"
      : type === "usage"
        ? "Uso / Cómo usar"
        : type === "measurements"
          ? "Medidas"
          : type === "versatility"
            ? "Versatilidad"
            : type === "media_strip"
              ? "Imagen ancha"
              : type;
  return heading ? `${base} — ${heading}` : base;
}

/**
 * Auditoría visual (Nivel 3): dado el borrador textual YA generado y las
 * fotos reales del proveedor, propone qué hacer con la imagen de cada
 * sección y de la galería principal. NUNCA genera ni sube ninguna imagen —
 * eso ocurre después, uno por uno, solo si el admin aprueba cada propuesta
 * (ver `generateProductImage.ts` / `uploadApprovedImage.ts`).
 */
export async function generateVisualAudit(
  draft: AIProductDraft,
  referencePhotos: string[],
  options: { client?: VisualAuditOpenAIClient; generatedAt?: string } = {}
): Promise<GenerateVisualAuditResult> {
  if (!isAIProductStudioEnabled()) {
    return { ok: false, code: "disabled", error: "El Estudio IA de Producto no está habilitado (AI_PRODUCT_STUDIO_ENABLED)." };
  }
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    return { ok: false, code: "not_configured", error: "Falta configurar OPENAI_API_KEY en el servidor." };
  }

  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const model = getAIProductStudioModel();
  const client = options.client ?? getDefaultClient();

  const imageRefs = referencePhotos.map((url, i) => ({ id: `image_${i + 1}`, url }));
  const idToUrl = new Map(imageRefs.map((r) => [r.id, r.url]));

  // Índice 0 = galería/portada (siempre presente); el resto son las secciones reales del borrador, en orden.
  const sectionsForPrompt: { index: number; id: string; type: string; label: string; currentImageUrl: string }[] = [
    { index: 0, id: "gallery", type: "gallery", label: "Galería principal / portada", currentImageUrl: draft.galleryImageUrls[0] ?? "" },
    ...draft.productSections.map((s, i) => ({
      index: i + 1,
      id: s.id,
      type: s.type,
      label: sectionLabelFor(s.type, "heading" in s.data ? s.data.heading : undefined),
      currentImageUrl: "image_url" in s.data ? s.data.image_url : "",
    })),
  ];

  const userPrompt = buildUserPrompt({
    sections: sectionsForPrompt.map((s) => ({ index: s.index, type: s.type, label: s.label, hasImage: Boolean(s.currentImageUrl) })),
    imageIds: imageRefs.map((r) => r.id),
  });

  const content: Record<string, unknown>[] = [{ type: "input_text", text: userPrompt }];
  for (const ref of imageRefs) {
    content.push({ type: "input_text", text: `Foto real ${ref.id}:` });
    content.push({ type: "input_image", image_url: ref.url, detail: "auto" });
  }

  let rawOutputText: string;
  try {
    const response = await client.responses.create(
      {
        model,
        instructions: SYSTEM_PROMPT,
        input: [{ role: "user", content }],
        text: { format: zodTextFormat(aiModelVisualAuditOutputSchema, "visual_audit") },
        store: false,
      },
      { timeout: REQUEST_TIMEOUT_MS }
    );
    rawOutputText = response.output_text ?? "";
  } catch (err) {
    if (err instanceof APIConnectionTimeoutError) {
      return { ok: false, code: "timeout", error: "OpenAI no respondió a tiempo. Intenta de nuevo." };
    }
    if (err instanceof APIError) {
      console.error("[ai-product-studio][visual-audit] error de la API de OpenAI:", { status: err.status, message: err.message });
      return { ok: false, code: "api_error", error: "OpenAI devolvió un error al analizar la ficha. Intenta de nuevo." };
    }
    console.error("[ai-product-studio][visual-audit] error inesperado llamando a OpenAI:", err);
    return { ok: false, code: "api_error", error: "No se pudo analizar la ficha. Intenta de nuevo." };
  }

  if (!rawOutputText.trim()) {
    return { ok: false, code: "invalid_response", error: "OpenAI no devolvió contenido (posible rechazo del modelo)." };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawOutputText);
  } catch {
    return { ok: false, code: "invalid_response", error: "La respuesta de OpenAI no es JSON válido." };
  }

  const modelResult = aiModelVisualAuditOutputSchema.safeParse(parsedJson);
  if (!modelResult.success) {
    console.error("[ai-product-studio][visual-audit] respuesta no calza con el schema:", modelResult.error.issues);
    return { ok: false, code: "invalid_response", error: "La respuesta de OpenAI no tiene el formato esperado." };
  }

  const audit = assembleAudit(modelResult.data, sectionsForPrompt, idToUrl, generatedAt);
  const finalResult = visualAuditSchema.safeParse(audit);
  if (!finalResult.success) {
    console.error("[ai-product-studio][visual-audit] auditoría final no calza con visualAuditSchema:", finalResult.error.issues);
    return { ok: false, code: "invalid_response", error: "La auditoría generada no pasó la validación final." };
  }

  return { ok: true, audit: finalResult.data };
}

/**
 * Ensambla la auditoría final desde la salida cruda del modelo. Reglas duras
 * aplicadas acá (no confían en que el modelo haya seguido el prompt al pie
 * de la letra — mismo principio de "defensa en profundidad" que
 * `generateAIDraft.ts`):
 *  - `sectionIndex` desconocido -> se descarta la sugerencia completa.
 *  - Sección "measurements" -> nunca queda con una acción generativa, pase
 *    lo que pase; se fuerza "use_supplier_photo" (si hay foto real) o
 *    "no_image_needed".
 *  - Acción generativa sin `referenceImageId` que resuelva a una foto real
 *    -> se degrada a "no_image_needed" (nunca se genera sin referencia real).
 *  - Acciones no generativas siempre quedan con `promptDraft: null`.
 */
function assembleAudit(
  model: AIModelVisualAuditOutput,
  sectionsForPrompt: { index: number; id: string; type: string; label: string; currentImageUrl: string }[],
  idToUrl: Map<string, string>,
  generatedAt: string
): VisualAudit {
  const sectionByIndex = new Map(sectionsForPrompt.map((s) => [s.index, s]));
  const warnings: string[] = [];
  const suggestions: VisualSuggestion[] = [];

  model.suggestions.forEach((raw, i) => {
    const section = sectionByIndex.get(raw.sectionIndex);
    if (!section) {
      warnings.push(`Se descartó una sugerencia con un índice de sección desconocido (${raw.sectionIndex}).`);
      return;
    }

    let action: VisualSuggestionAction = raw.action;
    let referenceImageUrl = raw.referenceImageId ? (idToUrl.get(raw.referenceImageId) ?? null) : null;

    if (section.type === "measurements" && GENERATIVE_VISUAL_ACTIONS.has(action)) {
      action = section.currentImageUrl ? "use_supplier_photo" : "no_image_needed";
      warnings.push(
        `Se forzó "${VISUAL_SUGGESTION_ACTION_LABELS[action]}" en la sección "${section.label}": una sección de Medidas nunca genera una imagen nueva.`
      );
    }

    if (GENERATIVE_VISUAL_ACTIONS.has(action) && !referenceImageUrl) {
      action = "no_image_needed";
      warnings.push(`Se descartó una sugerencia generativa en "${section.label}" por no traer una foto real de referencia válida.`);
    }

    const isGenerative = GENERATIVE_VISUAL_ACTIONS.has(action);
    if (!isGenerative) {
      // "use_supplier_photo" usa la foto ya asignada a la sección como referencia si el modelo no propuso una válida.
      if (action === "use_supplier_photo" && !referenceImageUrl && section.currentImageUrl) {
        referenceImageUrl = section.currentImageUrl;
      }
      if (action === "no_image_needed") referenceImageUrl = null;
    }

    suggestions.push({
      id: `vs-${i}`,
      sectionId: section.id,
      sectionType: section.type,
      sectionLabel: section.label,
      action,
      persuasiveGoal: raw.persuasiveGoal.trim(),
      referenceImageUrl,
      promptDraft: isGenerative ? raw.promptDraft.trim() || null : null,
      risks: raw.risks.map((r) => r.trim()).filter(Boolean),
    });
  });

  return { suggestions, generatedAt, warnings };
}
