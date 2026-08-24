import "server-only";

import { z } from "zod";
import OpenAI, { APIConnectionTimeoutError, APIError } from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { BENEFIT_ICONS, type ProductSection } from "@/lib/product/sections/types";
import {
  aiProductDraftSchema,
  DETECTED_FACT_SOURCES,
  type AIProductDraft,
  type AIProductStudioInput,
  type DetectedFact,
} from "./schema";
import { filterSupplierLines, looksLikeGenericHeading, NAME_PLACEHOLDER, truncate, truncateAtWordBoundary } from "./textFilters";
import { slugify } from "./slugify";
import { enforceAnchoredClaims, extractExplicitDimensions } from "./specClaims";
import {
  demoteMeasurementCoverImage,
  extractMeasurementTokensFromText,
  measurementSetsMatch,
  sanitizeMeasurementValues,
} from "./imageMeasurements";
import { getAIProductStudioModel, getOpenAIApiKey, isAIProductStudioEnabled } from "./openaiConfig";
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_SECTIONS = 8;
const GALLERY_FALLBACK_NOTICE = "Se conservó tu selección de galería.";

/**
 * Límites del schema FINAL persistido (`lib/product/sections/types.ts`),
 * repetidos acá como constantes con nombre para que `assembleDraft()` los
 * use al recortar campos secundarios de forma segura (ver más abajo) — nunca
 * un número mágico suelto. Los schemas `aiModel*` que le exigimos al modelo
 * (justo debajo) usan un margen MAYOR a estos límites a propósito: así un
 * campo secundario un poco más largo de lo ideal no tira abajo la
 * generación completa (antes: 240 duro en varios campos, incluida la
 * instrucción comercial del admin — bug reportado con los creativos de
 * magnesio). Lo que sobre el límite persistido se recorta recién en
 * `assembleDraft()`, nunca antes ni en el schema del modelo.
 */
const PERSISTED_HEADING_MAX = 80;
const PERSISTED_ALT_MAX = 180;
const PERSISTED_BENEFIT_TITLE_MAX = 60;
const PERSISTED_BENEFIT_DESCRIPTION_MAX = 240;
const PERSISTED_SINGLE_IMAGE_DESCRIPTION_MAX = 2000;

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
  // Margen sobre el límite persistido (60) — se recorta a 60 en assembleDraft() si hace falta, nunca rechaza la generación completa.
  title: z.string().max(100, "El título de un beneficio es demasiado largo."),
  // Margen sobre el límite persistido (240) — mismo criterio (caso real: descripciones de beneficios de un suplemento con varios ingredientes).
  description: z.string().max(360, "La descripción de un beneficio es demasiado larga."),
});

const aiModelSingleImageDataSchema = z.object({
  heading: z.string().max(120, "El título de una sección es demasiado largo."),
  description: z.string().max(PERSISTED_SINGLE_IMAGE_DESCRIPTION_MAX, "La descripción de una sección es demasiado larga."),
  imageId: z.string().nullable(),
  alt: z.string().max(220, "El texto alternativo de una imagen es demasiado largo."),
});

const aiModelBenefitsDataSchema = z.object({
  heading: z.string().max(120, "El título de la sección de beneficios es demasiado largo."),
  description: z.string().max(PERSISTED_SINGLE_IMAGE_DESCRIPTION_MAX, "La descripción de la sección de beneficios es demasiado larga."),
  imageId: z.string().nullable(),
  alt: z.string().max(220, "El texto alternativo de la imagen de beneficios es demasiado largo."),
  items: z.array(aiModelBenefitItemSchema).min(1).max(6),
});

const aiModelSectionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("benefits"), data: aiModelBenefitsDataSchema }),
  z.object({ type: z.literal("usage"), data: aiModelSingleImageDataSchema }),
  z.object({ type: z.literal("measurements"), data: aiModelSingleImageDataSchema }),
  z.object({ type: z.literal("versatility"), data: aiModelSingleImageDataSchema }),
]);

/**
 * Versión mínima de `detectedFactSchema` (schema.ts) SOLO para lo que el
 * modelo puede/debe reportar (`claim` + `source`) — el schema final tiene
 * campos adicionales (`imageUrl`, `value`, `confidence`) que el servidor
 * completa después de resolver IDs simbólicos a URLs reales; el modelo
 * nunca los llena directamente (mismo principio que `image_url` en los
 * bloques: el modelo solo conoce `imageId`, nunca una URL).
 */
const aiModelDetectedFactSchema = z.object({
  // "Datos técnicos detectados" nunca se recortan (ver assembleDraft()) —
  // por eso este límite es generoso de entrada en vez de contar con un
  // recorte posterior. 400 alcanza para un hecho detallado (ej. una lista de
  // ingredientes de un suplemento) sin invitar a un párrafo entero.
  claim: z.string().max(400, "Un hecho detectado del proveedor es demasiado largo."),
  source: z.enum(DETECTED_FACT_SOURCES),
});

/**
 * Cotas/medidas detectadas por el modelo DENTRO de una imagen (diagrama
 * técnico con números y unidad impresos, ej. "17 cm", "10,5 cm",
 * "29 x 22 x 10 cm") — deliberadamente separado de `productSections` y de
 * `detectedFacts`: es el ÚNICO canal por el que una imagen puede aportar una
 * cifra numérica al borrador (regla 2/3/9 del prompt). El servidor valida
 * cada valor con un patrón real antes de usarlo (nunca confía en el string
 * crudo del modelo) y decide de forma determinista si crea/fusiona un
 * bloque "measurements" — el modelo no decide eso.
 */
const aiModelImageMeasurementSchema = z.object({
  imageId: z.string(),
  values: z.array(z.string().max(40)).max(6),
  /** true SOLO si los números y su unidad están escritos de forma legible e inequívoca en la imagen — false si es una estimación visual o no está claro. */
  clear: z.boolean(),
});

const aiModelOutputSchema = z.object({
  name: z.string().max(80, "El nombre propuesto es demasiado largo."),
  category: z.string().max(60, "La categoría propuesta es demasiado larga."),
  tags: z.array(z.string().max(30, "Una etiqueta es demasiado larga.")).max(10),
  descriptionHtml: z.string().max(4000, "La descripción del producto es demasiado larga."),
  productSections: z.array(aiModelSectionSchema).max(MAX_SECTIONS),
  galleryImageIds: z.array(z.string()).max(6),
  detectedFacts: z.array(aiModelDetectedFactSchema).max(30),
  imageMeasurements: z.array(aiModelImageMeasurementSchema).max(6),
  // Nunca se recorta después (son advertencias/afirmaciones a evitar, no
  // contenido de la ficha) — se le da margen igual para no rechazar la
  // generación completa por una advertencia un poco más larga de lo ideal.
  claimsToAvoid: z.array(z.string().max(300, "Una afirmación a evitar es demasiado larga.")).max(20),
  fieldsNeedingConfirmation: z.array(z.string().max(40, "Un nombre de campo por confirmar es demasiado largo.")).max(10),
});
type AIModelOutput = z.infer<typeof aiModelOutputSchema>;

// ─── Prompt del sistema (reglas del Estudio IA de Producto) ──────────────────

const SYSTEM_PROMPT = `Eres el redactor del "Estudio IA de Producto" de una tienda online chilena. Tu única tarea es transformar el texto crudo de un proveedor (y, si se entregan, fotos del producto) en un borrador estructurado de ficha de producto para que un administrador humano lo revise, edite y recién después decida guardarlo. Nunca guardas ni publicas nada tú mismo.

Reglas obligatorias, sin excepción:

1. Escribe una ficha persuasiva, clara y profesional, en español de Chile. El nombre propuesto debe ser breve y vendible — no repitas adjetivos del texto del proveedor de forma redundante (ej. si el texto ya dice "portátil" en el nombre, no lo repitas dos veces ni lo fuerces si suena artificial). La descripción ("descriptionHtml") debe tener 2 a 3 párrafos concretos (envueltos en <p>), nunca relleno genérico. Cada beneficio debe ser una frase clara y directa (título corto + una oración), nunca un párrafo largo.
2. Puedes usar las imágenes para afirmar aspectos visualmente observables: color, forma, uso visible, ambiente, composición. Una foto NUNCA es evidencia suficiente para INFERIR O ESTIMAR materiales exactos, medidas numéricas, potencia, certificaciones ni ninguna especificación técnica por su apariencia — aunque "se vea" de cierto material o tamaño, eso no confirma la especificación real. EXCEPCIÓN ÚNICA Y ESTRECHA: si una imagen es un diagrama técnico con cotas/medidas IMPRESAS como texto legible (líneas de medida con número y unidad, ej. "17 cm", "10,5 cm", "29 x 22 x 10 cm"), repórtalas leyéndolas literalmente en el campo "imageMeasurements" — nunca en "productSections", "descriptionHtml" ni "detectedFacts". Es lectura de texto impreso, no una estimación visual. Nunca combines ni promedies números de imágenes distintas, nunca conviertas unidades, nunca infieras a qué corresponde cada número si el diagrama no lo indica con claridad.
3. Especificaciones técnicas, potencia, material, garantía, envío/tiempos de despacho, certificaciones, compatibilidad, capacidad de carga, radiación UV, seguridad eléctrica, tiempos de secado ("en X minutos"), salud o seguridad SOLO pueden venir explícitamente del texto del proveedor que se te entrega. Si el texto no lo menciona, no lo afirmes — jamás, ni siquiera como sugerencia. Las medidas/dimensiones son la única excepción con dos fuentes válidas: el texto del proveedor (como cualquier otra especificación) O cotas impresas y legibles en una imagen técnica, reportadas exclusivamente vía "imageMeasurements" (regla 2) — nunca inventes ni combines ninguna otra especificación a partir de una imagen.
4. Elimina cualquier contenido del proveedor que no le corresponde a esta tienda: contacto/WhatsApp del proveedor, links externos, "confirmar stock/inventario", ofertas o descuentos ajenos, despacho a cargo de terceros, garantías de Dropi u otro proveedor, instrucciones administrativas internas. Ese contenido no debe aparecer en ningún campo de tu respuesta.
5. Si no hay evidencia suficiente para un dato, NO lo inventes: agrégalo a "fieldsNeedingConfirmation" (si falta un campo entero, ej. "category") o a "claimsToAvoid" (si es una afirmación específica que no puedes hacer). "category" y "tags" son propuestas editables y opcionales, no obligatorias — si no tienes confianza razonable, déjalas vacías en vez de adivinar.
6. Cada imagen que recibes viene etiquetada con un ID exacto (image_1, image_2, image_3...), anunciado justo antes de la imagen en el mensaje. NUNCA generes, escribas ni inventes una URL de imagen — no las conoces y no existen para ti. Para "galleryImageIds" y para el campo "imageId" de cualquier bloque debes responder SOLO con estos IDs exactos (ej. "image_1"), nunca con una URL, nunca con un ID que no te hayan mostrado. Si ningún ID es adecuado para un bloque en particular, usa "imageId": null. Elige, de los IDs entregados, cuáles son los más adecuados para la galería y para cada bloque.
7. Solo puedes proponer bloques de tipo "benefits", "usage", "measurements" o "versatility", y solo si hay evidencia real que los respalde. NUNCA generes bloques de FAQ, testimonios, comparador "antes/después" ni certificaciones — esos requieren inventar preguntas, reseñas de clientes falsas o decidir arbitrariamente qué imagen es "antes"/"después". Si el texto del proveedor incluye medidas o dimensiones explícitas (ej. "29 x 22 x 10 cm", "40cm de alto"), DEBES crear un bloque "measurements" ("Medidas") con un título claro y un texto que explique esas dimensiones tal como las da el texto, sin inventar unidades ni cifras adicionales — no lo dejes solo mencionado dentro de la descripción general ni lo omitas.
8. Nunca uses un encabezado genérico de sección ("Características destacadas", "Descripción", "Ficha técnica", "Información del producto", etc.) como si fuera el nombre del producto. Si no puedes inferir con confianza un nombre real de producto, usa exactamente el texto "Nombre por confirmar".
9. Para "imageMeasurements": por cada imagen que sea CLARAMENTE un diagrama técnico de medidas con números y unidad impresos y legibles, agrega una entrada con su "imageId", el arreglo "values" (cada valor tal como aparece, ej. ["17 cm", "10,5 cm", "5 cm"] o ["29 x 22 x 10 cm"]) y "clear": true. Si una imagen parece mostrar medidas pero no puedes leerlas con certeza, agrega igual la entrada con "clear": false (deja "values" vacío si no puedes leer ningún valor con confianza — nunca inventes uno solo para llenar el campo). Para imágenes sin cotas visibles, no agregues ninguna entrada. Nunca mezcles valores de dos imágenes distintas en una misma entrada — cada imagen es su propia entrada, con sus propios valores. Si una imagen con cotas claras ("clear": true) es un diagrama técnico (no una foto comercial/lifestyle del producto) y hay otras imágenes disponibles, no la propongas como la primera de "galleryImageIds": prioriza una imagen comercial como portada.

Para cada afirmación que incluyas en "detectedFacts", indica su fuente: "supplier_text" si viene del texto del proveedor, "supplier_image" si es una observación puramente visual de una imagen (nunca uses "supplier_image" para una especificación técnica ni para medidas — las medidas detectadas en una imagen van exclusivamente en "imageMeasurements", nunca en "detectedFacts").

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

interface ConfirmedMeasurementGroup {
  imageUrl: string;
  values: string[];
}

/**
 * Interpreta `model.imageMeasurements` (cotas detectadas por el modelo en
 * imágenes) en dos salidas separadas:
 *  - `detectedFacts`: entradas para la UI ("Medidas detectadas en imagen"),
 *    tanto confirmadas como "needs_review" (estas últimas nunca generan un
 *    bloque, solo informan al admin que hay algo por revisar a mano).
 *  - `confirmedGroups`: solo las entradas `clear: true` con al menos un
 *    valor real (validado con `sanitizeMeasurementValues`, nunca confía en
 *    el string crudo del modelo) y un `imageId` que resuelve a una imagen
 *    realmente seleccionada — son las únicas candidatas a crear/fusionar un
 *    bloque "measurements".
 */
function resolveImageMeasurementFacts(
  raw: AIModelOutput["imageMeasurements"],
  resolveImageId: (id: string | null) => string
): { detectedFacts: DetectedFact[]; confirmedGroups: ConfirmedMeasurementGroup[]; warnings: string[] } {
  const detectedFacts: DetectedFact[] = [];
  const confirmedGroups: ConfirmedMeasurementGroup[] = [];
  const warnings: string[] = [];

  for (const entry of raw) {
    const imageUrl = resolveImageId(entry.imageId);
    if (!imageUrl) continue; // ID desconocido -> se descarta silenciosamente, igual que en cualquier otro bloque.

    const values = sanitizeMeasurementValues(entry.values);
    if (values.length === 0) {
      if (entry.clear) {
        warnings.push(
          'El modelo reportó medidas en una imagen pero ningún valor tenía un formato de medida válido (ej. "17 cm"); se ignoró.'
        );
      }
      continue;
    }

    if (entry.clear) {
      confirmedGroups.push({ imageUrl, values });
      detectedFacts.push({
        claim: `Medidas detectadas en imagen: ${values.join(", ")}.`,
        source: "supplier_image",
        imageUrl,
        value: values.join(", "),
        confidence: "confirmed",
      });
    } else {
      detectedFacts.push({
        claim: `Posibles medidas en una imagen del proveedor (lectura no confirmada): ${values.join(", ")}.`,
        source: "supplier_image",
        imageUrl,
        value: values.join(", "),
        confidence: "needs_review",
      });
    }
  }

  return { detectedFacts, confirmedGroups, warnings };
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
 *  - Después de esa pasada, `model.imageMeasurements` (cotas leídas de una
 *    imagen, ver `resolveImageMeasurementFacts`) se procesa POR SEPARADO:
 *    si no hay ya un bloque "measurements" (ni del modelo ni del texto), se
 *    crea uno determinísticamente con la imagen exacta que trae las cotas;
 *    si ya hay uno (del texto), se compara — mismos valores => se fusiona
 *    (misma sección, imagen de cotas como referencia visual); valores
 *    distintos => se deja advertencia, nunca se decide cuál es la correcta.
 *    Esto corre DESPUÉS de `enforceAnchoredClaims` a propósito: el bloque
 *    que arma esta función ya viene validado con un patrón real de medida
 *    (`sanitizeMeasurementValues`), no es prosa libre del modelo, así que no
 *    necesita (ni debe) pasar por el barrido anti-alucinación otra vez.
 *  - La portada de la galería nunca es una imagen técnica de medidas si hay
 *    otra disponible (`demoteMeasurementCoverImage`) — nunca se elimina de
 *    la galería, solo se baja de posición, y queda avisado en `warnings`.
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

  /**
   * Igual que `cleanOptionalText`, pero además recorta de forma segura
   * (palabra completa + "…", ver `truncateAtWordBoundary`) al límite del
   * schema FINAL persistido — así un campo SECUNDARIO (encabezado, `alt`,
   * descripción de una tarjeta de beneficio) que el modelo devolvió más
   * largo de lo ideal nunca tira abajo la generación completa. Solo se usa
   * en campos secundarios: nunca en nombre/slug, datos comerciales, medidas
   * ni hechos técnicos detectados (esos usan `cleanOptionalText` sin
   * recorte, con su propio límite ya generoso en el schema del modelo).
   */
  function cleanOptionalTextTruncated(raw: string, maxLength: number): string | undefined {
    const truncated = truncateAtWordBoundary(raw, maxLength);
    return truncated.length > 0 ? truncated : undefined;
  }

  let productSections: ProductSection[] = model.productSections.slice(0, MAX_SECTIONS).map((section, i): ProductSection => {
    const base = { id: `ai-${section.type}-${i}`, enabled: true as const, order: i };
    if (section.type === "benefits") {
      return {
        ...base,
        type: "benefits",
        data: {
          heading: cleanOptionalTextTruncated(section.data.heading, PERSISTED_HEADING_MAX),
          description: cleanOptionalTextTruncated(section.data.description, PERSISTED_SINGLE_IMAGE_DESCRIPTION_MAX),
          image_url: resolveImageId(section.data.imageId),
          alt: cleanOptionalTextTruncated(section.data.alt, PERSISTED_ALT_MAX),
          items: section.data.items.map((item) => ({
            icon: item.icon,
            title: truncateAtWordBoundary(item.title, PERSISTED_BENEFIT_TITLE_MAX),
            description: truncateAtWordBoundary(item.description, PERSISTED_BENEFIT_DESCRIPTION_MAX),
          })),
        },
      };
    }
    return {
      ...base,
      type: section.type,
      data: {
        heading: cleanOptionalTextTruncated(section.data.heading, PERSISTED_HEADING_MAX),
        // Medidas es la única excepción: su descripción ES la dimensión real
        // ("Las medidas indicadas... son: 17 cm, ..."). Regla dura: nunca se
        // recorta contenido técnico/dimensiones, aunque el límite del modelo
        // (2000) ya es tan generoso que en la práctica nunca hace falta cortar.
        description:
          section.type === "measurements"
            ? cleanOptionalText(section.data.description)
            : cleanOptionalTextTruncated(section.data.description, PERSISTED_SINGLE_IMAGE_DESCRIPTION_MAX),
        image_url: resolveImageId(section.data.imageId),
        alt: cleanOptionalTextTruncated(section.data.alt, PERSISTED_ALT_MAX),
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

  // ── Medidas detectadas en imágenes (cotas impresas, ver imageMeasurements.ts) ──
  const imageMeasurements = resolveImageMeasurementFacts(model.imageMeasurements, resolveImageId);
  warnings.push(...imageMeasurements.warnings);

  let finalProductSections = anchored.productSections;
  if (imageMeasurements.confirmedGroups.length > 0) {
    const existingIndex = finalProductSections.findIndex((s) => s.type === "measurements");
    if (existingIndex === -1) {
      if (finalProductSections.length < MAX_SECTIONS) {
        const primary = imageMeasurements.confirmedGroups[0];
        finalProductSections = [
          ...finalProductSections,
          {
            id: `ai-measurements-image-${finalProductSections.length}`,
            type: "measurements",
            enabled: true,
            order: finalProductSections.length,
            data: {
              heading: "Medidas referenciales",
              description: `Las medidas indicadas en la imagen del proveedor son: ${primary.values.join(", ")}.`,
              image_url: primary.imageUrl,
              alt: undefined,
            },
          },
        ];
        warnings.push(
          `Se agregó un bloque "Medidas" a partir de cotas detectadas en una imagen del proveedor (${primary.values.join(", ")}).`
        );
        if (imageMeasurements.confirmedGroups.length > 1) {
          warnings.push(
            'Se detectaron medidas en más de una imagen del proveedor; se usó solo la primera para no mezclar cifras de imágenes distintas. Revisa manualmente si corresponde agregar la otra.'
          );
        }
      }
    } else {
      const existing = finalProductSections[existingIndex];
      const existingTokens =
        existing.type === "measurements" ? extractMeasurementTokensFromText(existing.data.description ?? "") : [];
      const matching = imageMeasurements.confirmedGroups.find((g) => measurementSetsMatch(existingTokens, g.values));
      if (matching) {
        finalProductSections = finalProductSections.map((s, i) =>
          i === existingIndex && s.type === "measurements"
            ? { ...s, data: { ...s.data, image_url: matching.imageUrl } }
            : s
        );
        warnings.push(
          'Las medidas del texto del proveedor coinciden con las de una imagen; se usó esa imagen como referencia visual del bloque "Medidas".'
        );
      } else {
        const imageValuesList = imageMeasurements.confirmedGroups.map((g) => g.values.join(", ")).join(" / ");
        warnings.push(
          `Se detectaron medidas distintas entre el texto del proveedor (${existingTokens.join(", ") || "sin cifras claras"}) y una imagen (${imageValuesList}) — revisa manualmente cuál es correcta antes de publicar; no se modificó el bloque "Medidas" automáticamente.`
        );
      }
    }
  }

  // ── Portada: nunca una imagen técnica de medidas si hay otra disponible ──
  const measurementImageUrls = new Set(imageMeasurements.confirmedGroups.map((g) => g.imageUrl));
  const cover = demoteMeasurementCoverImage(galleryImageUrls, measurementImageUrls);
  if (cover.changed) {
    galleryImageUrls = cover.urls;
    warnings.push(
      'Se evitó usar una imagen técnica de medidas como portada de la galería; se priorizó otra imagen. Puedes cambiar el orden manualmente antes de guardar.'
    );
  }

  const claimsToAvoid = Array.from(new Set([...model.claimsToAvoid, ...anchored.addedClaimsToAvoid]));
  const detectedFacts: DetectedFact[] = [...model.detectedFacts, ...imageMeasurements.detectedFacts];

  return {
    name,
    slug,
    category: model.category.trim(),
    tags: model.tags.map((t) => t.trim()).filter(Boolean),
    descriptionHtml: anchored.descriptionHtml,
    productSections: finalProductSections,
    galleryImageUrls,
    detectedFacts,
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
