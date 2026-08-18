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
import { enforceAnchoredClaims, extractExplicitDimensions } from "./specClaims";
import { getAIProductStudioModel, getOpenAIApiKey, isAIProductStudioEnabled } from "./openaiConfig";
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_SECTIONS = 8;
const GALLERY_FALLBACK_NOTICE = "Se conservó tu selección de galería.";

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

// ─── Referencias de imagen seguras (image_1, image_2, ...) ───────────────────
// El modelo NUNCA ve ni devuelve una URL de imagen — solo estos IDs. Así es
// estructuralmente imposible que "invente" o distorsione una URL: cualquier
// ID que no esté en este mapa se descarta en `resolveImageId`, nunca se deja
// pasar una URL cruda que el modelo hubiera escrito.
function buildImageRefs(selectedImages: string[]): { id: string; url: string }[] {
  return selectedImages.map((url, i) => ({ id: `image_${i + 1}`, url }));
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
  imageId: z.string().nullable(),
  alt: z.string().max(180),
});

const aiModelBenefitsDataSchema = z.object({
  heading: z.string().max(80),
  description: z.string().max(2000),
  imageId: z.string().nullable(),
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
  galleryImageIds: z.array(z.string()).max(6),
  detectedFacts: z.array(detectedFactSchema).max(30),
  claimsToAvoid: z.array(z.string().max(200)).max(20),
  fieldsNeedingConfirmation: z.array(z.string().max(40)).max(10),
});
type AIModelOutput = z.infer<typeof aiModelOutputSchema>;

// ─── Prompt del sistema (reglas del Estudio IA de Producto) ──────────────────

const SYSTEM_PROMPT = `Eres el redactor del "Estudio IA de Producto" de una tienda online chilena. Tu única tarea es transformar el texto crudo de un proveedor (y, si se entregan, fotos del producto) en un borrador estructurado de ficha de producto para que un administrador humano lo revise, edite y recién después decida guardarlo. Nunca guardas ni publicas nada tú mismo.

Reglas obligatorias, sin excepción:

1. Escribe una ficha persuasiva, clara y profesional, en español de Chile. El nombre propuesto debe ser breve y vendible — no repitas adjetivos del texto del proveedor de forma redundante (ej. si el texto ya dice "portátil" en el nombre, no lo repitas dos veces ni lo fuerces si suena artificial). La descripción ("descriptionHtml") debe tener 2 a 3 párrafos concretos (envueltos en <p>), nunca relleno genérico. Cada beneficio debe ser una frase clara y directa (título corto + una oración), nunca un párrafo largo.
2. Puedes usar las imágenes ÚNICAMENTE para afirmar aspectos visualmente observables: color, forma, uso visible, ambiente, composición. Una foto NUNCA es evidencia suficiente para afirmar materiales exactos, medidas numéricas, potencia, certificaciones ni ninguna especificación técnica — aunque "se vea" de cierto material, eso no confirma la especificación real.
3. Especificaciones técnicas, potencia, medidas, material, garantía, envío/tiempos de despacho, certificaciones, compatibilidad, capacidad de carga, radiación UV, seguridad eléctrica, tiempos de secado ("en X minutos"), salud o seguridad SOLO pueden venir explícitamente del texto del proveedor que se te entrega. Si el texto no lo menciona, no lo afirmes — jamás, ni siquiera como sugerencia.
4. Elimina cualquier contenido del proveedor que no le corresponde a esta tienda: contacto/WhatsApp del proveedor, links externos, "confirmar stock/inventario", ofertas o descuentos ajenos, despacho a cargo de terceros, garantías de Dropi u otro proveedor, instrucciones administrativas internas. Ese contenido no debe aparecer en ningún campo de tu respuesta.
5. Si no hay evidencia suficiente para un dato, NO lo inventes: agrégalo a "fieldsNeedingConfirmation" (si falta un campo entero, ej. "category") o a "claimsToAvoid" (si es una afirmación específica que no puedes hacer). "category" y "tags" son propuestas editables y opcionales, no obligatorias — si no tienes confianza razonable, déjalas vacías en vez de adivinar.
6. Cada imagen que recibes viene etiquetada con un ID exacto (image_1, image_2, image_3...), anunciado justo antes de la imagen en el mensaje. NUNCA generes, escribas ni inventes una URL de imagen — no las conoces y no existen para ti. Para "galleryImageIds" y para el campo "imageId" de cualquier bloque debes responder SOLO con estos IDs exactos (ej. "image_1"), nunca con una URL, nunca con un ID que no te hayan mostrado. Si ningún ID es adecuado para un bloque en particular, usa "imageId": null. Elige, de los IDs entregados, cuáles son los más adecuados para la galería y para cada bloque.
7. Solo puedes proponer bloques de tipo "benefits", "usage", "measurements" o "versatility", y solo si hay evidencia real que los respalde. NUNCA generes bloques de FAQ, testimonios, comparador "antes/después" ni certificaciones — esos requieren inventar preguntas, reseñas de clientes falsas o decidir arbitrariamente qué imagen es "antes"/"después". Si el texto del proveedor incluye medidas o dimensiones explícitas (ej. "29 x 22 x 10 cm", "40cm de alto"), DEBES crear un bloque "measurements" ("Medidas") con un título claro y un texto que explique esas dimensiones tal como las da el texto, sin inventar unidades ni cifras adicionales — no lo dejes solo mencionado dentro de la descripción general ni lo omitas.
8. Nunca uses un encabezado genérico de sección ("Características destacadas", "Descripción", "Ficha técnica", "Información del producto", etc.) como si fuera el nombre del producto. Si no puedes inferir con confianza un nombre real de producto, usa exactamente el texto "Nombre por confirmar".

Para cada afirmación que incluyas en "detectedFacts", indica su fuente: "supplier_text" si viene del texto del proveedor, "image_visual" si es una observación puramente visual de una imagen (nunca uses "image_visual" para una especificación técnica).

Responde únicamente con el JSON estructurado solicitado.`;

function buildUserPrompt(input: {
  cleanedSupplierText: string;
  commercialGoal?: string;
  tone: string;
  imageIds: string[];
}): string {
  const parts: string[] = [
    `Tono solicitado: ${input.tone}.`,
    input.commercialGoal ? `Instrucción comercial del admin: ${input.commercialGoal}` : "Sin instrucción comercial adicional.",
    input.imageIds.length > 0
      ? `Imágenes entregadas, en este orden: ${input.imageIds.join(", ")}. Para galería y bloques debes responder solo con estos IDs exactos.`
      : "No se entregaron imágenes.",
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

  const imageRefs = buildImageRefs(input.selectedImages);

  const userPrompt = buildUserPrompt({
    cleanedSupplierText,
    commercialGoal: input.commercialGoal?.trim() || undefined,
    tone: input.tone,
    imageIds: imageRefs.map((r) => r.id),
  });

  // Contenido multimodal: el texto, y luego cada imagen precedida por un
  // rótulo con su ID — así el modelo puede referirse a "image_2" sabiendo
  // exactamente a qué foto corresponde, sin necesitar (ni poder) ver su URL.
  const content: Record<string, unknown>[] = [{ type: "input_text", text: userPrompt }];
  for (const ref of imageRefs) {
    content.push({ type: "input_text", text: `Imagen ${ref.id}:` });
    content.push({ type: "input_image", image_url: ref.url, detail: "auto" });
  }

  let rawOutputText: string;
  try {
    const response = await client.responses.create(
      {
        model,
        instructions: SYSTEM_PROMPT,
        input: [{ role: "user", content }],
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

  const draft = assembleDraft(
    modelResult.data,
    input,
    imageRefs,
    cleanedSupplierText,
    cleanedSupplierTextLower,
    ignoredSupplierLines,
    generatedAt,
    model
  );

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
 *  - Cada `imageId` (galería y bloques) se resuelve a una URL SOLO si
 *    corresponde a una de las imágenes que el admin realmente seleccionó —
 *    cualquier ID desconocido se descarta, nunca se acepta una URL directa
 *    del modelo (el modelo no puede escribir URLs, ver `aiModelOutputSchema`).
 *  - `id`/`enabled`/`order` de cada bloque los asigna el servidor.
 *  - Si el texto trae dimensiones explícitas y el modelo no generó un bloque
 *    "measurements", se agrega uno automáticamente (regla 7 del prompt,
 *    reforzada acá como red de seguridad determinística).
 *  - `enforceAnchoredClaims` vuelve a barrer specs técnicas (potencia,
 *    medidas, temporizador, enchufe universal, certificaciones, garantía,
 *    capacidad de carga, UV, seguridad eléctrica, tiempo de secado, promesas
 *    de despacho, salud) que el modelo hubiera mencionado sin respaldo en el
 *    texto — red de seguridad, no confía en que el prompt haya bastado.
 */
function assembleDraft(
  model: AIModelOutput,
  input: AIProductStudioInput,
  imageRefs: { id: string; url: string }[],
  cleanedSupplierText: string,
  cleanedSupplierTextLower: string,
  ignoredSupplierLines: string[],
  generatedAt: string,
  modelName: string
): AIProductDraft {
  const idToUrl = new Map(imageRefs.map((r) => [r.id, r.url]));
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

  let danglingImageIds = 0;
  /** Resuelve un ID de imagen propuesto por el modelo a su URL real — nunca acepta nada que no esté en `idToUrl` (nunca una URL directa: el modelo no las conoce). */
  function resolveImageId(id: string | null): string {
    if (!id) return "";
    const url = idToUrl.get(id);
    if (!url) {
      danglingImageIds += 1;
      return "";
    }
    return url;
  }

  let galleryImageUrls: string[];
  if (model.galleryImageIds.length === 0) {
    galleryImageUrls = [...input.selectedImages];
    warnings.push(GALLERY_FALLBACK_NOTICE);
  } else {
    const resolved = model.galleryImageIds.map(resolveImageId).filter((u): u is string => Boolean(u));
    if (resolved.length === 0) {
      galleryImageUrls = [...input.selectedImages];
      warnings.push(GALLERY_FALLBACK_NOTICE);
    } else {
      galleryImageUrls = resolved;
      if (resolved.length !== model.galleryImageIds.length) {
        warnings.push("Se descartaron uno o más IDs de imagen inválidos propuestos por el modelo; se usó el resto en el orden propuesto.");
      }
    }
  }

  /** Texto opcional: "" (el modelo no tenía nada que decir) se guarda como campo ausente, no como string vacío. */
  function cleanOptionalText(raw: string): string | undefined {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  let productSections: ProductSection[] = model.productSections.slice(0, MAX_SECTIONS).map((section, i): ProductSection => {
    const base = { id: `ai-${section.type}-${i}`, enabled: true as const, order: i };
    if (section.type === "benefits") {
      return {
        ...base,
        type: "benefits",
        data: {
          heading: cleanOptionalText(section.data.heading),
          description: cleanOptionalText(section.data.description),
          image_url: resolveImageId(section.data.imageId),
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
        image_url: resolveImageId(section.data.imageId),
        alt: cleanOptionalText(section.data.alt),
      },
    };
  });
  if (danglingImageIds > 0) {
    warnings.push(`Se descartó el ID de imagen propuesto por el modelo en ${danglingImageIds} bloque(s) por no corresponder a una imagen seleccionada.`);
  }

  // Red de seguridad determinística: si el texto trae dimensiones explícitas
  // y el modelo no generó un bloque "measurements", se agrega acá — no
  // depende de que el modelo haya seguido la regla 7 del prompt al pie de la letra.
  const hasMeasurementsSection = productSections.some((s) => s.type === "measurements");
  if (!hasMeasurementsSection && productSections.length < MAX_SECTIONS) {
    const dimensions = extractExplicitDimensions(cleanedSupplierText);
    if (dimensions) {
      productSections = [
        ...productSections,
        {
          id: `ai-measurements-auto-${productSections.length}`,
          type: "measurements",
          enabled: true,
          order: productSections.length,
          data: {
            heading: "Medidas",
            description: `Dimensiones: ${dimensions}.`,
            image_url: galleryImageUrls[0] ?? "",
            alt: undefined,
          },
        },
      ];
      warnings.push('Se agregó automáticamente un bloque "Medidas" porque el texto del proveedor incluye dimensiones explícitas que no estaban reflejadas en ningún bloque.');
    }
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
