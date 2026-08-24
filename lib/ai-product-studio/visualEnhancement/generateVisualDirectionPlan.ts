import "server-only";

import { z } from "zod";
import OpenAI, { APIConnectionTimeoutError, APIError } from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import type { AIProductDraft } from "../schema";
import { getAIProductStudioModel, getOpenAIApiKey, isAIProductStudioEnabled } from "../openaiConfig";
import {
  COVER_ELIGIBLE_CATEGORIES,
  GALLERY_EXCLUDED_CATEGORIES,
  GENERATION_INTENTS,
  IMAGE_CATEGORIES,
  IMAGE_CATEGORY_LABELS,
  type GenerationIntent,
  type GenerationProposal,
  type ImageCategory,
  type ImageClassification,
  type SectionImagePlan,
  type VisualDirectionPlan,
} from "./imageDirectionPlan";

const REQUEST_TIMEOUT_MS = 45_000;
const MAX_SECTIONS_FOR_PLAN = 12;

/** Mismo tipo de cliente inyectable que el resto del Nivel 3 (solo usa `responses.create`) — permite mockear en tests sin tocar OpenAI real. */
export interface VisualDirectionOpenAIClient {
  responses: {
    create: (params: Record<string, unknown>, options?: { timeout?: number }) => Promise<{ output_text?: string }>;
  };
}

// Estos textos son editoriales (razones, objetivos, prompts) — ninguno se
// vuelve a validar contra un schema más estricto después (a diferencia de
// benefits/detectedFacts en generateAIDraft.ts), así que acá basta con darles
// un límite generoso de entrada; no necesitan un recorte posterior.
const aiModelImageClassificationSchema = z.object({
  imageId: z.string(),
  category: z.enum(IMAGE_CATEGORIES),
  reason: z.string().max(300, "La razón de clasificación de una imagen es demasiado larga."),
});

const aiModelSectionAssignmentSchema = z.object({
  /** 0 = galería/portada (se resuelve de forma determinista, ver más abajo); 1..N = productSections en orden. */
  sectionIndex: z.number().int(),
  imageId: z.string().nullable(),
  assignmentReason: z.string().max(300, "La razón de asignación de una sección es demasiado larga."),
  needsGeneration: z.boolean(),
  generationIntent: z.enum(GENERATION_INTENTS).nullable(),
  // "Prompt visual interno": puede necesitar instrucciones detalladas — nunca comparte el límite corto de los campos editoriales cortos.
  generationPrompt: z.string().max(1200, "El prompt de generación es demasiado largo."),
  generationPersuasiveGoal: z.string().max(300, "El objetivo persuasivo de una propuesta es demasiado largo."),
  generationRisks: z.array(z.string().max(300, "Un riesgo listado es demasiado largo.")).max(6),
});

const aiModelVisualDirectionOutputSchema = z.object({
  classifications: z.array(aiModelImageClassificationSchema).max(20),
  coverImageId: z.string().nullable(),
  coverReason: z.string().max(300, "La razón de portada es demasiado larga."),
  /** Orden propuesto para la galería pública — el servidor igual filtra categorías excluidas. */
  galleryOrder: z.array(z.string()).max(20),
  sections: z.array(aiModelSectionAssignmentSchema).max(MAX_SECTIONS_FOR_PLAN),
});
type AIModelVisualDirectionOutput = z.infer<typeof aiModelVisualDirectionOutputSchema>;

const SYSTEM_PROMPT = `Eres el director de arte del "Estudio IA de Producto" de una tienda online chilena. Ya existe un borrador de ficha (nombre, descripción, bloques). Tu tarea es clasificar cada foto real del proveedor y proponer un plan visual editorial: qué imagen va de portada, en qué orden va la galería pública, y qué imagen (real o a generar) le corresponde a cada sección — nunca generas ni describes contenido nuevo del producto acá, solo planificas. Un administrador humano revisa y aprueba todo después.

Reglas obligatorias, sin excepción:

1. Clasifica CADA foto real entregada en exactamente una categoría: "clean_cover" (portada limpia, el producto solo, sin texto ni logos), "in_use" (producto en uso real), "kit_accessories" (kit o accesorios visibles), "detail" (detalle/acercamiento), "measurements" (diagrama técnico con cotas), "promotional_graphic" (gráfica publicitaria: texto grande, precios, sellos, logos del proveedor, banners), "collage" (composición de varias fotos en una sola imagen), "low_quality" (borrosa, mal encuadrada, no recomendable). Da una razón breve y concreta para cada una (ej. "Texto grande 'Design leve' cubre el producto" — nunca inventes qué dice el texto si no lo puedes leer con certeza, describe que hay texto/gráfica superpuesta).
2. La portada ("coverImageId") SOLO puede ser una imagen que tú mismo clasificaste como "clean_cover" o "in_use". Nunca una gráfica promocional, un diagrama de medidas, un collage ni una imagen de baja calidad — aunque sea la única imagen disponible. Si ninguna foto califica, responde "coverImageId": null y dilo en "coverReason" (ej. "Ninguna foto es una portada limpia o de uso real; queda por confirmar").
3. "galleryOrder" es tu propuesta de orden para la galería pública — nunca incluyas ahí una imagen "measurements", "promotional_graphic", "collage" ni "low_quality" (esas nunca van en la galería pública por defecto).
4. Para cada sección de la ficha (te entrego una lista numerada, índice 0 = galería/portada, no le asignes nada ahí porque la portada ya se resuelve con las reglas 2 y 3), propone como máximo UNA imagen real (por su "imageId") o, si ninguna es adecuada, marca "needsGeneration": true. NUNCA repitas la misma imagen en dos secciones distintas — cada sección necesita una imagen exclusiva. NUNCA propongas una imagen "promotional_graphic", "collage" ni "low_quality" para ninguna sección.
5. La sección de tipo "measurements" (Medidas) es especial: SOLO puede recibir una imagen clasificada "measurements" tuya. NUNCA marques "needsGeneration": true para esa sección — las medidas jamás se generan con IA, solo pueden venir de una foto real con cotas.
6. Cuando "needsGeneration" sea true (excepto en Medidas, donde nunca aplica), elige "generationIntent" entre "product_in_use" (producto en uso), "lifestyle_context" (contexto/lifestyle), "functional_detail" (detalle funcional) u "organized_kit" (kit organizado) — el que mejor refuerce esa sección. "generationPrompt" debe describir SOLO cambios de entorno/contexto/composición sobre una foto real de referencia (usa "imageId" de una foto real ya entregada, puede repetirse como referencia aunque esa foto ya se haya usado en otra sección — generar no "gasta" la foto original). Nunca pidas cambiar forma, piezas, color, marca o accesorios reales del producto. "generationRisks" lista qué NO debe afirmar/mostrar la imagen resultante (specs, capacidad, certificaciones, accesorios inventados).
7. Nunca inventes especificaciones, accesorios, colores, tamaños, materiales, certificaciones, resultados de uso ni usos no respaldados por las fotos o el texto ya analizado.

Responde únicamente con el JSON estructurado solicitado.`;

function buildUserPrompt(input: {
  sections: { index: number; type: string; label: string }[];
  imageIds: string[];
  productName: string;
}): string {
  const sectionLines = input.sections.map((s) => `${s.index}. [${s.type}] ${s.label}`).join("\n");
  return [
    `Producto: ${input.productName}`,
    "",
    "Secciones de la ficha (usa el número exacto como sectionIndex; el índice 0 es la galería/portada, no le asignes imagen ahí):",
    sectionLines,
    "",
    input.imageIds.length > 0
      ? `Fotos reales del proveedor entregadas, en este orden: ${input.imageIds.join(", ")}. Usa solo estos IDs exactos para "imageId"/"coverImageId"/"galleryOrder".`
      : "No se entregaron fotos reales.",
  ].join("\n");
}

export type GenerateVisualDirectionPlanErrorCode =
  | "disabled"
  | "not_configured"
  | "timeout"
  | "api_error"
  | "invalid_response";

export type GenerateVisualDirectionPlanResult =
  | { ok: true; plan: VisualDirectionPlan }
  | { ok: false; code: GenerateVisualDirectionPlanErrorCode; error: string };

let cachedClient: VisualDirectionOpenAIClient | null = null;
function getDefaultClient(): VisualDirectionOpenAIClient {
  if (cachedClient) return cachedClient;
  cachedClient = new OpenAI({ apiKey: getOpenAIApiKey() }) as unknown as VisualDirectionOpenAIClient;
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

function defaultPromptForIntent(intent: GenerationIntent, productName: string): string {
  switch (intent) {
    case "product_in_use":
      return `Muestra el producto "${productName}" en uso real, en un ambiente simple y creíble, sin cambiar su apariencia.`;
    case "lifestyle_context":
      return `Ambienta el producto "${productName}" en un entorno cotidiano acogedor que transmita confianza, sin agregar texto ni elementos ajenos al producto.`;
    case "functional_detail":
      return `Acércate a un detalle funcional real y visible del producto "${productName}" (algo que ya se vea en la foto de referencia), sin inventar piezas nuevas.`;
    case "organized_kit":
      return `Muestra el producto "${productName}" junto a sus accesorios reales ordenados prolijamente, tal como aparecen en la foto de referencia, sin agregar accesorios que no existan.`;
  }
}

const DEFAULT_GENERATION_RISKS = ["No inventar especificaciones, accesorios ni certificaciones que no aparezcan en la foto real."];

/**
 * "Dirección visual de ficha": clasifica cada foto real, decide la portada y
 * el orden de galería, y arma un plan de UNA imagen (real o a generar) por
 * sección — nunca genera ni sube ninguna imagen todavía. Reemplaza a la
 * auditoría plana anterior (`generateVisualAudit.ts`, retirado) porque una
 * prueba real (un taladro) mostró que sin clasificar primero, la IA podía
 * elegir una gráfica promocional como portada y repetirla en varias secciones.
 */
export async function generateVisualDirectionPlan(
  draft: AIProductDraft,
  referencePhotos: string[],
  options: { client?: VisualDirectionOpenAIClient; generatedAt?: string } = {}
): Promise<GenerateVisualDirectionPlanResult> {
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

  const sectionsForPlan = [
    { index: 0, id: "gallery", type: "gallery", label: "Galería principal / portada" },
    ...draft.productSections.map((s, i) => ({
      index: i + 1,
      id: s.id,
      type: s.type,
      label: sectionLabelFor(s.type, "heading" in s.data ? s.data.heading : undefined),
    })),
  ].slice(0, MAX_SECTIONS_FOR_PLAN);

  const userPrompt = buildUserPrompt({
    sections: sectionsForPlan.map((s) => ({ index: s.index, type: s.type, label: s.label })),
    imageIds: imageRefs.map((r) => r.id),
    productName: draft.name || "este producto",
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
        text: { format: zodTextFormat(aiModelVisualDirectionOutputSchema, "visual_direction_plan") },
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
      console.error("[ai-product-studio][visual-direction-plan] error de la API de OpenAI:", { status: err.status, message: err.message });
      return { ok: false, code: "api_error", error: "OpenAI devolvió un error al planificar la ficha. Intenta de nuevo." };
    }
    console.error("[ai-product-studio][visual-direction-plan] error inesperado llamando a OpenAI:", err);
    return { ok: false, code: "api_error", error: "No se pudo planificar la ficha. Intenta de nuevo." };
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

  const modelResult = aiModelVisualDirectionOutputSchema.safeParse(parsedJson);
  if (!modelResult.success) {
    console.error("[ai-product-studio][visual-direction-plan] respuesta no calza con el schema:", modelResult.error.issues);
    return { ok: false, code: "invalid_response", error: "La respuesta de OpenAI no tiene el formato esperado." };
  }

  const plan = assemblePlan(modelResult.data, draft, referencePhotos, sectionsForPlan, idToUrl, generatedAt);
  return { ok: true, plan };
}

function assemblePlan(
  model: AIModelVisualDirectionOutput,
  draft: AIProductDraft,
  referencePhotos: string[],
  sectionsForPlan: { index: number; id: string; type: string; label: string }[],
  idToUrl: Map<string, string>,
  generatedAt: string
): VisualDirectionPlan {
  const warnings: string[] = [];

  // ── 1. Clasificación: TODA foto real entregada queda clasificada, aunque el modelo la haya omitido ──
  const categoryByUrl = new Map<string, ImageCategory>();
  const reasonByUrl = new Map<string, string>();
  for (const c of model.classifications) {
    const url = idToUrl.get(c.imageId);
    if (!url) {
      warnings.push(`Se descartó una clasificación con un ID de imagen desconocido (${c.imageId}).`);
      continue;
    }
    categoryByUrl.set(url, c.category);
    reasonByUrl.set(url, c.reason.trim());
  }
  for (const url of referencePhotos) {
    if (categoryByUrl.has(url)) continue;
    categoryByUrl.set(url, "detail");
    reasonByUrl.set(url, "No fue clasificada por el modelo; se trata como imagen de detalle por defecto.");
    warnings.push("Una foto no fue clasificada por el modelo; se trató como 'Detalle' por seguridad (nunca como portada ni gráfica promocional por defecto).");
  }
  const classifications: ImageClassification[] = referencePhotos.map((url) => ({
    url,
    category: categoryByUrl.get(url)!,
    reason: reasonByUrl.get(url)!,
  }));

  // ── 2. Portada: SOLO clean_cover/in_use, nunca una excepción ──
  let coverUrl: string | null = null;
  let coverReason: string | null = null;
  const modelCoverUrl = model.coverImageId ? (idToUrl.get(model.coverImageId) ?? null) : null;
  if (modelCoverUrl && COVER_ELIGIBLE_CATEGORIES.has(categoryByUrl.get(modelCoverUrl)!)) {
    coverUrl = modelCoverUrl;
    coverReason = model.coverReason.trim() || reasonByUrl.get(modelCoverUrl) || "Imagen limpia del producto.";
  } else {
    if (modelCoverUrl) {
      const cat = categoryByUrl.get(modelCoverUrl)!;
      warnings.push(
        `Se descartó la portada propuesta por el modelo (categoría "${IMAGE_CATEGORY_LABELS[cat]}"): la portada solo puede ser "Portada limpia" o "Producto en uso".`
      );
    }
    const fallback =
      referencePhotos.find((u) => categoryByUrl.get(u) === "clean_cover") ??
      referencePhotos.find((u) => categoryByUrl.get(u) === "in_use") ??
      null;
    if (fallback) {
      coverUrl = fallback;
      coverReason = reasonByUrl.get(fallback) ?? "Imagen limpia del producto.";
    } else {
      warnings.push(
        'No se encontró una foto apta para portada (limpia o en uso) — queda "Portada por confirmar". Nunca se elige automáticamente una gráfica promocional, un diagrama de medidas ni un collage.'
      );
    }
  }

  // ── 3. Galería recomendada: excluye medidas/gráfica promocional/collage/baja calidad ──
  const recommendedOrder: string[] = [];
  if (coverUrl) recommendedOrder.push(coverUrl);
  const proposedOrder = model.galleryOrder.map((id) => idToUrl.get(id)).filter((u): u is string => Boolean(u));
  for (const url of proposedOrder) {
    if (recommendedOrder.includes(url)) continue;
    if (GALLERY_EXCLUDED_CATEGORIES.has(categoryByUrl.get(url)!)) continue;
    recommendedOrder.push(url);
  }
  for (const url of referencePhotos) {
    if (recommendedOrder.includes(url)) continue;
    if (GALLERY_EXCLUDED_CATEGORIES.has(categoryByUrl.get(url)!)) continue;
    recommendedOrder.push(url);
  }
  const discarded = referencePhotos
    .filter((url) => GALLERY_EXCLUDED_CATEGORIES.has(categoryByUrl.get(url)!))
    .map((url) => ({ url, category: categoryByUrl.get(url)!, reason: reasonByUrl.get(url) ?? "" }));

  // ── 4. Asignación por sección: exclusiva, nunca repetida, nunca fuera de categoría ──
  const usedImageUrls = new Set<string>();
  if (coverUrl) usedImageUrls.add(coverUrl);
  const modelBySectionIndex = new Map(model.sections.map((s) => [s.sectionIndex, s]));

  // Pre-cómputo: qué foto quiere cada sección (validada por categoría, sin
  // resolver todavía conflictos de orden). Sirve para que el fallback de una
  // sección NUNCA le "robe" a otra la foto que el modelo ya le reservó — es
  // justo el bug real que mostró el taladro: al maletín se le asignaba a
  // "Kit organizado" más adelante en la lista, pero el fallback de "Uso" (que
  // se procesa antes) lo agarraba igual por estar "libre" en ese momento.
  const candidateBySectionId = new Map<string, string | null>();
  for (const section of sectionsForPlan) {
    if (section.id === "gallery" || section.type === "measurements") continue;
    const entry = modelBySectionIndex.get(section.index);
    const raw = entry?.imageId ? (idToUrl.get(entry.imageId) ?? null) : null;
    const valid = raw && !GALLERY_EXCLUDED_CATEGORIES.has(categoryByUrl.get(raw)!) ? raw : null;
    candidateBySectionId.set(section.id, valid);
  }
  const claimedUrls = new Set(Array.from(candidateBySectionId.values()).filter((u): u is string => Boolean(u)));

  const sections: SectionImagePlan[] = [];

  for (const section of sectionsForPlan) {
    if (section.id === "gallery") {
      sections.push({
        sectionId: "gallery",
        sectionType: "gallery",
        sectionLabel: section.label,
        assignedImageUrl: coverUrl,
        assignmentReason: coverReason,
        needsGeneration: coverUrl === null,
        generationProposal:
          coverUrl === null ? buildCoverGenerationFallback(referencePhotos, categoryByUrl, draft.name || "el producto") : null,
      });
      continue;
    }

    const modelEntry = modelBySectionIndex.get(section.index);

    if (section.type === "measurements") {
      // Regla dura 5: NUNCA se genera. Solo una foto real clasificada "measurements".
      let assignedUrl = modelEntry?.imageId ? (idToUrl.get(modelEntry.imageId) ?? null) : null;
      if (!assignedUrl || categoryByUrl.get(assignedUrl) !== "measurements") {
        assignedUrl = referencePhotos.find((u) => categoryByUrl.get(u) === "measurements" && !usedImageUrls.has(u)) ?? null;
      }
      const reason = assignedUrl
        ? (modelEntry?.assignmentReason?.trim() || "Única foto real con cotas confirmadas disponible.")
        : null;
      if (assignedUrl) usedImageUrls.add(assignedUrl);
      else
        warnings.push(
          `La sección "${section.label}" no tiene una foto real de medidas — nunca se genera con IA; complétala manualmente si corresponde.`
        );
      sections.push({
        sectionId: section.id,
        sectionType: section.type,
        sectionLabel: section.label,
        assignedImageUrl: assignedUrl,
        assignmentReason: reason,
        needsGeneration: false,
        generationProposal: null,
      });
      continue;
    }

    // `candidateBySectionId` ya filtró categorías excluidas — acá solo queda
    // revisar si otra sección (procesada antes) ya se llevó ese candidato.
    let assignedUrl = candidateBySectionId.get(section.id) ?? null;
    let assignmentReason = modelEntry?.assignmentReason?.trim() || null;

    if (assignedUrl && usedImageUrls.has(assignedUrl)) {
      warnings.push(`Se descartó la imagen propuesta para "${section.label}": ya se usó en otra sección — cada sección necesita una imagen exclusiva.`);
      assignedUrl = null;
    } else if (!assignedUrl && modelEntry?.imageId) {
      // El modelo propuso un ID que existe, pero resolvió a una categoría excluida.
      const rejected = idToUrl.get(modelEntry.imageId);
      if (rejected) {
        const cat = categoryByUrl.get(rejected)!;
        warnings.push(
          `Se descartó la imagen propuesta para "${section.label}" (categoría "${IMAGE_CATEGORY_LABELS[cat]}"): no puede usarse en una sección de la ficha pública.`
        );
      }
    }

    if (!assignedUrl) {
      // Solo se usa una foto que NINGUNA otra sección reclamó explícitamente
      // — nunca se le "roba" a otra su foto reservada (ej. el maletín para
      // "Kit organizado" no puede terminar en "Uso" solo porque a Uso le
      // toca procesarse primero). Si no queda ninguna libre y sin reclamar,
      // la sección pasa a proponer generación en vez de robar una asignación
      // ajena.
      const unclaimed = referencePhotos.find(
        (u) => !usedImageUrls.has(u) && !GALLERY_EXCLUDED_CATEGORIES.has(categoryByUrl.get(u)!) && !claimedUrls.has(u)
      );
      if (unclaimed) {
        assignedUrl = unclaimed;
        assignmentReason = "Foto real disponible que no se usó en otra sección.";
      }
    }

    if (assignedUrl) {
      usedImageUrls.add(assignedUrl);
      sections.push({
        sectionId: section.id,
        sectionType: section.type,
        sectionLabel: section.label,
        assignedImageUrl: assignedUrl,
        assignmentReason,
        needsGeneration: false,
        generationProposal: null,
      });
      continue;
    }

    // Sin foto real disponible -> proponer generación en vez de reciclar una imagen repetida.
    const intent: GenerationIntent = modelEntry?.needsGeneration && modelEntry.generationIntent ? modelEntry.generationIntent : "functional_detail";
    // La referencia de generación NUNCA puede ser una gráfica promocional/collage/baja
    // calidad/medidas — usarla como base de edición arrastraría su texto/branding
    // superpuesto (o cifras) al resultado "limpio". Se valida aunque el modelo la
    // haya propuesto igual.
    const refCandidateRaw = modelEntry?.imageId ? idToUrl.get(modelEntry.imageId) : undefined;
    const refCandidate =
      refCandidateRaw && !GALLERY_EXCLUDED_CATEGORIES.has(categoryByUrl.get(refCandidateRaw)!) ? refCandidateRaw : undefined;
    const referenceImageUrl =
      refCandidate ?? referencePhotos.find((u) => !GALLERY_EXCLUDED_CATEGORIES.has(categoryByUrl.get(u)!)) ?? referencePhotos[0];

    const generationProposal: GenerationProposal | null = referenceImageUrl
      ? {
          intent,
          persuasiveGoal: modelEntry?.generationPersuasiveGoal?.trim() || `Reforzar "${section.label}" con una imagen complementaria.`,
          referenceImageUrl,
          promptDraft: modelEntry?.generationPrompt?.trim() || defaultPromptForIntent(intent, draft.name || "el producto"),
          risks: modelEntry?.generationRisks?.map((r) => r.trim()).filter(Boolean).length
            ? modelEntry!.generationRisks.map((r) => r.trim()).filter(Boolean)
            : DEFAULT_GENERATION_RISKS,
        }
      : null;

    sections.push({
      sectionId: section.id,
      sectionType: section.type,
      sectionLabel: section.label,
      assignedImageUrl: null,
      assignmentReason: null,
      needsGeneration: true,
      generationProposal,
    });
  }

  return {
    classifications,
    gallery: { recommendedOrder, coverUrl, coverReason, discarded },
    sections,
    generatedAt,
    warnings,
  };
}

function buildCoverGenerationFallback(
  referencePhotos: string[],
  categoryByUrl: Map<string, ImageCategory>,
  productName: string
): GenerationProposal | null {
  const ref =
    referencePhotos.find((u) => categoryByUrl.get(u) === "in_use") ??
    referencePhotos.find((u) => categoryByUrl.get(u) === "detail") ??
    referencePhotos.find((u) => categoryByUrl.get(u) === "kit_accessories") ??
    referencePhotos.find((u) => !GALLERY_EXCLUDED_CATEGORIES.has(categoryByUrl.get(u)!)) ??
    referencePhotos[0];
  if (!ref) return null;
  return {
    intent: "lifestyle_context",
    persuasiveGoal: "Portada atractiva y confiable para la ficha, sin depender de una gráfica promocional ni un diagrama.",
    referenceImageUrl: ref,
    promptDraft: defaultPromptForIntent("lifestyle_context", productName),
    risks: DEFAULT_GENERATION_RISKS,
  };
}
