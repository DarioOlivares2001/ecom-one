import "server-only";

import { z } from "zod";
import OpenAI, { APIConnectionTimeoutError, APIError } from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { BENEFIT_ICONS, type ProductSection } from "@/lib/product/sections/types";
import {
  aiProductDraftSchema,
  detectedFactSchema,
  type AIProductDraft,
  type AIProductStudioInput,
} from "./schema";
import { filterSupplierLines, looksLikeGenericHeading, NAME_PLACEHOLDER, truncate } from "./textFilters";
import { slugify } from "./slugify";
import { enforceAnchoredClaims } from "./specClaims";
import { getAIProductStudioModel, getOpenAIApiKey, isAIProductStudioEnabled } from "./openaiConfig";
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_SECTIONS = 8;

/**
 * Interfaz mínima que necesitamos del cliente de OpenAI — permite inyectar
 * un cliente mock en tests sin tocar la red ni credenciales reales. El
 * cliente real (`new OpenAI({ apiKey })`) satisface esta interfaz tal cual.
 */
export interface AIProductStudioOpenAIClient {
  responses: {
    create: (params: Record<string, unknown>, options?: { timeout?: number }) => Promise<{ output_text?: string }>;
  };
}

// ─── Schema del output que se le exige al modelo (subconjunto seguro) ────────
// Solo 4 tipos de bloque: benefits/usage/measurements/versatility — nunca
// faq/testimonials/before_after/media_strip/visual_sequence (regla 7). Sin
// `id`/`order`/`enabled` (los asigna el servidor) y sin `slug` (regla:
// "no confiar ciegamente en el modelo; normalízalo en servidor").
//
// OJO: estos schemas NO son los mismos de `lib/product/sections/types.ts` a
// propósito. Los "Structured Outputs" estrictos de OpenAI no soportan
// `.optional()`/`.default()` sin `.nullable()` (todo campo debe ser
// obligatorio en el JSON Schema) — acá cada campo de texto es un string
// obligatorio (vacío = "sin dato"), y `assembleDraft()` lo convierte al
// shape real (con sus opcionales) antes de validar contra
// `productSectionsSchema`, que es el que de verdad se persiste.

const aiModelBenefitItemSchema = z.object({
  icon: z.enum(BENEFIT_ICONS),
  title: z.string().max(60),
  description: z.string().max(240),
});

const aiModelSingleImageDataSchema = z.object({
  heading: z.string().max(80),
  description: z.string().max(2000),
  image_url: z.string(),
  alt: z.string().max(180),
});

const aiModelBenefitsDataSchema = z.object({
  heading: z.string().max(80),
  description: z.string().max(2000),
  image_url: z.string(),
  alt: z.string().max(180),
  items: z.array(aiModelBenefitItemSchema).min(1).max(6),
});

const aiModelSectionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("benefits"), data: aiModelBenefitsDataSchema }),
  z.object({ type: z.literal("usage"), data: aiModelSingleImageDataSchema }),
  z.object({ type: z.literal("measurements"), data: aiModelSingleImageDataSchema }),
  z.object({ type: z.literal("versatility"), data: aiModelSingleImageDataSchema }),
]);

const aiModelOutputSchema = z.object({
  name: z.string().max(80),
  category: z.string().max(60),
  tags: z.array(z.string().max(30)).max(10),
  descriptionHtml: z.string().max(4000),
  productSections: z.array(aiModelSectionSchema).max(MAX_SECTIONS),
  galleryImageUrls: z.array(z.string()).max(6),
  detectedFacts: z.array(detectedFactSchema).max(30),
  claimsToAvoid: z.array(z.string().max(200)).max(20),
  fieldsNeedingConfirmation: z.array(z.string().max(40)).max(10),
});
type AIModelOutput = z.infer<typeof aiModelOutputSchema>;

// ─── Prompt del sistema (reglas 1-8 del Estudio IA de Producto) ──────────────

const SYSTEM_PROMPT = `Eres el redactor del "Estudio IA de Producto" de una tienda online chilena. Tu única tarea es transformar el texto crudo de un proveedor (y, si se entregan, fotos del producto) en un borrador estructurado de ficha de producto para que un administrador humano lo revise, edite y recién después decida guardarlo. Nunca guardas ni publicas nada tú mismo.

Reglas obligatorias, sin excepción:

1. Escribe una ficha persuasiva, clara y profesional, en español de Chile.
2. Puedes usar las imágenes ÚNICAMENTE para afirmar aspectos visualmente observables: color, forma, uso visible, ambiente, composición. Una foto NUNCA es evidencia suficiente para afirmar materiales exactos, medidas numéricas, potencia, certificaciones ni ninguna especificación técnica — aunque "se vea" de cierto material, eso no confirma la especificación real.
3. Especificaciones técnicas, potencia, medidas, material, garantía, envío, certificaciones, compatibilidad, salud o seguridad SOLO pueden venir explícitamente del texto del proveedor que se te entrega. Si el texto no lo menciona, no lo afirmes — jamás.
4. Elimina cualquier contenido del proveedor que no le corresponde a esta tienda: contacto/WhatsApp del proveedor, links externos, "confirmar stock/inventario", ofertas o descuentos ajenos, despacho a cargo de terceros, garantías de Dropi u otro proveedor, instrucciones administrativas internas. Ese contenido no debe aparecer en ningún campo de tu respuesta.
5. Si no hay evidencia suficiente para un dato, NO lo inventes: agrégalo a "fieldsNeedingConfirmation" (si falta un campo entero, ej. "category") o a "claimsToAvoid" (si es una afirmación específica que no puedes hacer).
6. Elige, de las imágenes ya subidas que se te entregan, cuáles son las más adecuadas para la galería y para cada bloque — nunca generes, modifiques ni inventes una URL de imagen nueva. "galleryImageUrls" y cualquier "image_url" dentro de un bloque deben ser exactamente URLs de las imágenes que se te entregaron.
7. Solo puedes proponer bloques de tipo "benefits", "usage", "measurements" o "versatility", y solo si hay evidencia real que los respalde. NUNCA generes bloques de FAQ, testimonios, comparador "antes/después" ni certificaciones — esos requieren inventar preguntas, reseñas de clientes falsas o decidir arbitrariamente qué imagen es "antes"/"después".
8. Nunca uses un encabezado genérico de sección ("Características destacadas", "Descripción", "Ficha técnica", "Información del producto", etc.) como si fuera el nombre del producto. Si no puedes inferir con confianza un nombre real de producto, usa exactamente el texto "Nombre por confirmar".

Para cada afirmación que incluyas en "detectedFacts", indica su fuente: "supplier_text" si viene del texto del proveedor, "image_visual" si es una observación puramente visual de una imagen (nunca uses "image_visual" para una especificación técnica).

Responde únicamente con el JSON estructurado solicitado.`;

function buildUserPrompt(input: {
  cleanedSupplierText: string;
  commercialGoal?: string;
  tone: string;
  imageCount: number;
}): string {
  const parts: string[] = [
    `Tono solicitado: ${input.tone}.`,
    input.commercialGoal ? `Instrucción comercial del admin: ${input.commercialGoal}` : "Sin instrucción comercial adicional.",
    `Cantidad de imágenes entregadas: ${input.imageCount} (en el mismo orden en que aparecen en el mensaje).`,
    "",
    "Texto del proveedor (ya filtrado de contenido que no corresponde a la tienda):",
    input.cleanedSupplierText,
  ];
  return parts.join("\n");
}

// ─── Resultado tipado ──────────────────────────────────────────────────────

export type GenerateAIDraftErrorCode =
  | "disabled"
  | "not_configured"
  | "timeout"
  | "api_error"
  | "invalid_response";

export type GenerateAIDraftResult =
  | { ok: true; draft: AIProductDraft }
  | { ok: false; code: GenerateAIDraftErrorCode; error: string };

let cachedClient: AIProductStudioOpenAIClient | null = null;

function getDefaultClient(): AIProductStudioOpenAIClient {
  if (cachedClient) return cachedClient;
  cachedClient = new OpenAI({ apiKey: getOpenAIApiKey() }) as unknown as AIProductStudioOpenAIClient;
  return cachedClient;
}

/**
 * Genera un `AIProductDraft` real con OpenAI (Responses API + Structured
 * Outputs). Nunca lanza — todos los fallos (deshabilitado, sin configurar,
 * timeout, error de API, respuesta inválida) vuelven como
 * `{ ok: false, code, error }` para que la ruta que llama pueda mostrar un
 * mensaje claro al admin sin filtrar detalles internos ni la API key.
 */
export async function generateAIDraft(
  input: AIProductStudioInput,
  options: { client?: AIProductStudioOpenAIClient; generatedAt?: string } = {}
): Promise<GenerateAIDraftResult> {
  if (!isAIProductStudioEnabled()) {
    return {
      ok: false,
      code: "disabled",
      error: "El Estudio IA de Producto no está habilitado (AI_PRODUCT_STUDIO_ENABLED).",
    };
  }

  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    return {
      ok: false,
      code: "not_configured",
      error: "Falta configurar OPENAI_API_KEY en el servidor.",
    };
  }

  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const model = getAIProductStudioModel();
  const client = options.client ?? getDefaultClient();

  // El filtrado de líneas ignorables corre ANTES de construir el prompt: el
  // modelo nunca ve WhatsApp/URLs/confirmación de stock/etc. (ver textFilters.ts).
  const { usableLines, ignoredSupplierLines } = filterSupplierLines(input.supplierText);
  const cleanedSupplierText = usableLines.join("\n");
  const cleanedSupplierTextLower = cleanedSupplierText.toLowerCase();

  const userPrompt = buildUserPrompt({
    cleanedSupplierText,
    commercialGoal: input.commercialGoal?.trim() || undefined,
    tone: input.tone,
    imageCount: input.selectedImages.length,
  });

  let rawOutputText: string;
  try {
    const response = await client.responses.create(
      {
        model,
        instructions: SYSTEM_PROMPT,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: userPrompt },
              ...input.selectedImages.map((url) => ({
                type: "input_image" as const,
                image_url: url,
                detail: "auto" as const,
              })),
            ],
          },
        ],
        text: { format: zodTextFormat(aiModelOutputSchema, "product_draft") },
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
      console.error("[ai-product-studio] error de la API de OpenAI:", { status: err.status, message: err.message });
      return { ok: false, code: "api_error", error: "OpenAI devolvió un error al generar el borrador. Intenta de nuevo." };
    }
    console.error("[ai-product-studio] error inesperado llamando a OpenAI:", err);
    return { ok: false, code: "api_error", error: "No se pudo generar el borrador. Intenta de nuevo." };
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

  const modelResult = aiModelOutputSchema.safeParse(parsedJson);
  if (!modelResult.success) {
    console.error("[ai-product-studio] respuesta de OpenAI no calza con el schema:", modelResult.error.issues);
    return { ok: false, code: "invalid_response", error: "La respuesta de OpenAI no tiene el formato esperado." };
  }

  const draft = assembleDraft(modelResult.data, input, cleanedSupplierTextLower, ignoredSupplierLines, generatedAt, model);

  const finalResult = aiProductDraftSchema.safeParse(draft);
  if (!finalResult.success) {
    console.error("[ai-product-studio] borrador final no calza con aiProductDraftSchema:", finalResult.error.issues);
    return { ok: false, code: "invalid_response", error: "El borrador generado no pasó la validación final." };
  }

  return { ok: true, draft: finalResult.data };
}

/**
 * Ensambla el `AIProductDraft` final desde la salida cruda del modelo:
 *  - `slug` se calcula en servidor desde `name`, nunca desde el modelo.
 *  - Cada `image_url` (galería y bloques) se valida contra las imágenes
 *    REALMENTE seleccionadas por el admin — cualquier URL que no calce se
 *    descarta, nunca se deja pasar.
 *  - `id`/`enabled`/`order` de cada bloque los asigna el servidor.
 *  - `enforceAnchoredClaims` vuelve a barrer specs técnicas (potencia,
 *    medidas, temporizador, enchufe universal, certificaciones, garantía,
 *    salud) que el modelo hubiera mencionado sin respaldo en el texto — red
 *    de seguridad, no confía en que el prompt haya bastado.
 */
function assembleDraft(
  model: AIModelOutput,
  input: AIProductStudioInput,
  cleanedSupplierTextLower: string,
  ignoredSupplierLines: string[],
  generatedAt: string,
  modelName: string
): AIProductDraft {
  const allowedImages = new Set(input.selectedImages);
  const warnings: string[] = [];

  // Defensa en profundidad: aunque el prompt ya instruye al modelo a nunca
  // usar un encabezado genérico como nombre, no confiamos ciegamente en que
  // lo haya cumplido — se reaplica la misma detección que usa el generador
  // demo (`looksLikeGenericHeading`) y se fuerza el placeholder si falla.
  const rawName = model.name.trim();
  const name = rawName && !looksLikeGenericHeading(rawName) ? truncate(rawName, 80) : NAME_PLACEHOLDER;
  const fieldsNeedingConfirmation = [...model.fieldsNeedingConfirmation];
  if (name === NAME_PLACEHOLDER && !fieldsNeedingConfirmation.includes("name")) {
    fieldsNeedingConfirmation.push("name");
  }
  const slug = name === NAME_PLACEHOLDER ? "" : slugify(name);
  if (name !== NAME_PLACEHOLDER && !slug && !fieldsNeedingConfirmation.includes("slug")) {
    fieldsNeedingConfirmation.push("slug");
  }

  let galleryImageUrls = model.galleryImageUrls.filter((u) => allowedImages.has(u));
  if (galleryImageUrls.length === 0) {
    warnings.push("El modelo no propuso imágenes válidas para la galería; se usaron todas las seleccionadas, en el orden elegido.");
    galleryImageUrls = [...input.selectedImages];
  } else if (galleryImageUrls.length !== model.galleryImageUrls.length) {
    warnings.push("Se descartaron una o más imágenes propuestas por el modelo que no pertenecían a las seleccionadas.");
  }

  let danglingImageUrls = 0;
  function sanitizeImageUrl(raw: string): string {
    if (!raw) return "";
    if (allowedImages.has(raw)) return raw;
    danglingImageUrls += 1;
    return "";
  }
  /** Texto opcional: "" (el modelo no tenía nada que decir) se guarda como campo ausente, no como string vacío. */
  function cleanOptionalText(raw: string): string | undefined {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  const productSections: ProductSection[] = model.productSections.slice(0, MAX_SECTIONS).map((section, i): ProductSection => {
    const base = { id: `ai-${section.type}-${i}`, enabled: true as const, order: i };
    if (section.type === "benefits") {
      return {
        ...base,
        type: "benefits",
        data: {
          heading: cleanOptionalText(section.data.heading),
          description: cleanOptionalText(section.data.description),
          image_url: sanitizeImageUrl(section.data.image_url),
          alt: cleanOptionalText(section.data.alt),
          items: section.data.items,
        },
      };
    }
    return {
      ...base,
      type: section.type,
      data: {
        heading: cleanOptionalText(section.data.heading),
        description: cleanOptionalText(section.data.description),
        image_url: sanitizeImageUrl(section.data.image_url),
        alt: cleanOptionalText(section.data.alt),
      },
    };
  });
  if (danglingImageUrls > 0) {
    warnings.push(`Se descartó la imagen propuesta por el modelo en ${danglingImageUrls} bloque(s) por no pertenecer a las imágenes seleccionadas.`);
  }

  const anchored = enforceAnchoredClaims({ descriptionHtml: model.descriptionHtml, productSections }, cleanedSupplierTextLower);

  const claimsToAvoid = Array.from(new Set([...model.claimsToAvoid, ...anchored.addedClaimsToAvoid]));

  return {
    name,
    slug,
    category: model.category.trim(),
    tags: model.tags.map((t) => t.trim()).filter(Boolean),
    descriptionHtml: anchored.descriptionHtml,
    productSections: anchored.productSections,
    galleryImageUrls,
    detectedFacts: model.detectedFacts,
    claimsToAvoid,
    fieldsNeedingConfirmation,
    ignoredSupplierLines,
    meta: {
      mode: "ai",
      generatedAt,
      model: modelName,
      warnings,
    },
  };
}
