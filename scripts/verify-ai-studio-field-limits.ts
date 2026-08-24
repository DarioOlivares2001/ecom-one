/**
 * Bug reportado: al presionar "Generar con IA" en el asistente, aparecía
 * "String must contain at most 240 character(s)" — un mensaje crudo de Zod,
 * sin traducir, sin decir qué campo. Causa raíz encontrada por inspección
 * directa (no supuesta): `aiProductStudioInputSchema.commercialGoal`
 * (`lib/ai-product-studio/schema.ts`) tenía `.max(240)` sin mensaje propio,
 * y el campo "Instrucción comercial" del Paso 1 no tenía ningún límite en la
 * UI (`maxLength`) — el propio `goToPreview()` del asistente hacía
 * `aiProductStudioInputSchema.safeParse(...)` ANTES de llamar al servidor y
 * mostraba `parsedInput.error.issues[0].message` crudo apenas la
 * instrucción comercial pasaba de 240 caracteres, algo perfectamente
 * plausible para un brief real (caso de prueba: creativos de magnesio).
 *
 * Esta prueba cubre:
 *  [0] `truncateAtWordBoundary` (pura).
 *  [1] El límite ampliado de `commercialGoal` + que el mensaje de error
 *      siempre sea en español y con el nombre del campo, nunca el texto
 *      crudo de Zod.
 *  [2] `generateAIDraft` con contenido largo real (beneficios e
 *      ingredientes de un suplemento de magnesio): la generación completa
 *      YA NO se rechaza por un campo secundario largo — se recorta de forma
 *      segura (palabra completa + "…") respetando el límite del schema
 *      persistido; los hechos técnicos detectados (ingredientes) NUNCA se
 *      recortan, solo tienen más margen.
 *  [3] `generateVisualDirectionPlan` con un prompt visual largo — nunca
 *      comparte el límite corto de 240.
 *
 * Cliente de OpenAI 100% mock — nunca llama a la red real ni gasta cuota,
 * nunca toca Neon/R2/productos.
 *
 * Uso: npx tsx --conditions=react-server scripts/verify-ai-studio-field-limits.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import {
  aiProductStudioInputSchema,
  describeAIProductStudioInputError,
  MAX_COMMERCIAL_GOAL_LENGTH,
  type AIProductStudioInput,
} from "../lib/ai-product-studio/schema";
import { truncateAtWordBoundary } from "../lib/ai-product-studio/textFilters";
import { generateAIDraft, type AIProductStudioOpenAIClient } from "../lib/ai-product-studio/generateAIDraft";
import {
  generateVisualDirectionPlan,
  type VisualDirectionOpenAIClient,
} from "../lib/ai-product-studio/visualEnhancement/generateVisualDirectionPlan";
import type { AIProductDraft } from "../lib/ai-product-studio/schema";
import { benefitItemSchema } from "../lib/product/sections/types";

let failures = 0;
function assert(condition: unknown, message: string): void {
  if (condition) {
    console.log(`  OK: ${message}`);
  } else {
    failures += 1;
    console.error(`  FALLO: ${message}`);
  }
}

const IMG = (n: number) => `https://pub-test.r2.dev/products/test-${n}.webp`;
const BASE_ENV = { AI_PRODUCT_STUDIO_ENABLED: "true", OPENAI_API_KEY: "sk-test-fake" };

function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => T): T {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) previous[key] = process.env[key];
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/** ¿`truncated` (sin la "…" final) es un prefijo REAL de `original`, cortado justo en un espacio (nunca a mitad de palabra)? */
function isWordBoundarySafeTruncation(original: string, truncated: string): boolean {
  if (!truncated.endsWith("…")) return false;
  const prefix = truncated.slice(0, -1).trimEnd();
  if (!original.startsWith(prefix)) return false;
  const nextChar = original[prefix.length];
  return nextChar === undefined || /\s/.test(nextChar);
}

function makeAIDraftMockClient(outputObj: unknown): AIProductStudioOpenAIClient {
  return { responses: { async create() { return { output_text: JSON.stringify(outputObj) }; } } };
}
function makePlanMockClient(outputObj: unknown): VisualDirectionOpenAIClient {
  return { responses: { async create() { return { output_text: JSON.stringify(outputObj) }; } } };
}

async function main() {
  // ── [0] truncateAtWordBoundary (pura) ───────────────────────────────────────
  console.log("[0] truncateAtWordBoundary — corte seguro por palabra completa");
  {
    assert(truncateAtWordBoundary("Texto corto", 240) === "Texto corto", "texto más corto que el límite queda intacto");

    const long = "Contiene magnesio bisglicinato, magnesio citrato, magnesio malato y vitamina B6 para mejorar la absorción y reducir la fatiga muscular y el cansancio diario de forma sostenida";
    const cut = truncateAtWordBoundary(long, 80);
    assert(cut.length <= 80, `el resultado nunca supera el límite (obtuvo largo ${cut.length})`);
    assert(cut.endsWith("…"), 'el resultado termina en "…" cuando sí se recortó');
    assert(isWordBoundarySafeTruncation(long, cut), `el corte respeta un límite de palabra completa (obtuvo: "${cut}")`);

    const oneLongWord = "a".repeat(500);
    const cutWord = truncateAtWordBoundary(oneLongWord, 50);
    assert(cutWord.length <= 50 && cutWord.endsWith("…"), "una sola palabra larguísima sin espacios cae a un corte duro, sin reventar");
  }

  // ── [1] commercialGoal: límite ampliado + mensaje SIEMPRE en español con el campo ──
  console.log("\n[1] commercialGoal: límite ampliado a 500, y el error nunca es el mensaje crudo de Zod");
  {
    const briefRealista =
      "Enfócalo en un tono cercano y confiable para un suplemento de magnesio: destaca la absorción superior de las 3 formas de magnesio combinadas, el efecto en el descanso y la recuperación muscular, y que es apto para toda la familia. Evita sonar como un anuncio de farmacia genérico.";
    assert(briefRealista.length > 240 && briefRealista.length <= MAX_COMMERCIAL_GOAL_LENGTH, "el brief de ejemplo es justo el caso real: pasa de 240 pero cabe en el nuevo límite");

    const parsedOk = aiProductStudioInputSchema.safeParse({
      supplierText: "Magnesio Triple Absorción\n- Bisglicinato, citrato y malato\n- Apoya el descanso",
      selectedImages: [IMG(1)],
      commercialGoal: briefRealista,
      tone: "confiable",
    });
    assert(parsedOk.success, "un brief de más de 240 caracteres (dentro del nuevo límite) YA NO rechaza la entrada");

    const tooLong = "x".repeat(MAX_COMMERCIAL_GOAL_LENGTH + 50);
    const parsedFail = aiProductStudioInputSchema.safeParse({
      supplierText: "Producto de prueba",
      selectedImages: [IMG(1)],
      commercialGoal: tooLong,
      tone: "directo",
    });
    assert(!parsedFail.success, "un brief realmente excesivo (por sobre el nuevo límite) sigue rechazándose");
    if (!parsedFail.success) {
      const message = describeAIProductStudioInputError(parsedFail.error);
      assert(message.includes("Instrucción comercial"), `el mensaje indica el campo afectado en español (obtuvo: "${message}")`);
      assert(!message.toLowerCase().includes("string must contain"), 'el mensaje NUNCA es el texto crudo de Zod ("String must contain...")');
      assert(message.includes(String(MAX_COMMERCIAL_GOAL_LENGTH)), "el mensaje indica el límite real");
    }
  }

  // ── [2] generateAIDraft con contenido largo real (magnesio) ────────────────
  console.log("\n[2] Creativos de magnesio: beneficios largos se recortan de forma segura; ingredientes detectados NUNCA se recortan");
  {
    const supplierText = [
      "Magnesio Triple Absorción 400mg",
      "- Combina bisglicinato, citrato y malato de magnesio para máxima biodisponibilidad",
      "- Apoya el descanso, la recuperación muscular y reduce el cansancio",
      "- Apto para toda la familia, sabor neutro",
    ].join("\n");

    const longBenefitDescription =
      "Esta combinación de tres formas de magnesio de alta absorción (bisglicinato, citrato y malato) trabaja en conjunto para apoyar tanto la función muscular como el sistema nervioso, ayudando a reducir el cansancio y la fatiga diaria mientras mejora la calidad del descanso nocturno de forma progresiva y sostenida en el tiempo";
    assert(longBenefitDescription.length > 240, "la descripción de beneficio de prueba efectivamente supera el límite persistido (240)");

    const longIngredientClaim =
      "Contiene bisglicinato de magnesio, citrato de magnesio, malato de magnesio y vitamina B6, combinados específicamente para mejorar la absorción intestinal, reducir molestias digestivas frente al magnesio tradicional, apoyar la función muscular y nerviosa normal, y favorecer un descanso nocturno de mejor calidad cuando se toma de forma constante todos los días";
    assert(longIngredientClaim.length > 240 && longIngredientClaim.length <= 400, "el hecho detectado de ingredientes supera 240 pero cabe en el nuevo margen (400)");

    const client = makeAIDraftMockClient({
      name: "Magnesio Triple Absorción 400mg",
      category: "Suplementos",
      tags: ["magnesio", "descanso"],
      descriptionHtml: "<p>Combina tres formas de magnesio de alta absorción.</p><p>Pensado para el descanso y la recuperación diaria.</p>",
      productSections: [
        {
          type: "benefits",
          data: {
            heading: "Beneficios",
            description: "",
            imageId: "image_1",
            alt: "",
            items: [
              { icon: "check", title: "Triple absorción", description: longBenefitDescription },
              { icon: "star", title: "Apto para toda la familia", description: "Sabor neutro, fácil de tomar a diario." },
            ],
          },
        },
      ],
      galleryImageIds: ["image_1"],
      detectedFacts: [{ claim: longIngredientClaim, source: "supplier_text" }],
      imageMeasurements: [],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
    });

    const input: AIProductStudioInput = {
      supplierText,
      selectedImages: [IMG(1)],
      tone: "confiable",
    };
    const result = await withEnv(BASE_ENV, () => generateAIDraft(input, { client, generatedAt: "2026-01-01T00:00:00.000Z" }));

    assert(result.ok, `la generación completa SE ACEPTA aunque un beneficio venga largo (obtuvo: ${result.ok ? "ok" : result.error})`);
    if (result.ok) {
      const benefitsSection = result.draft.productSections.find((s) => s.type === "benefits");
      const firstItem = benefitsSection?.type === "benefits" ? benefitsSection.data.items[0] : undefined;
      assert(Boolean(firstItem), "el bloque de beneficios y su primera tarjeta sobreviven");
      assert((firstItem?.description.length ?? 0) <= 240, `la descripción final respeta el límite persistido de 240 (obtuvo largo ${firstItem?.description.length})`);
      assert(
        Boolean(firstItem) && isWordBoundarySafeTruncation(longBenefitDescription, firstItem!.description),
        `el recorte de la descripción del beneficio respeta palabras completas (obtuvo: "${firstItem?.description}")`
      );

      const claim = result.draft.detectedFacts.find((f) => f.claim.includes("bisglicinato"));
      assert(claim?.claim === longIngredientClaim, "el hecho técnico detectado (ingredientes) llega EXACTO, sin recortar ni un carácter");

      assert(
        benefitItemSchema.safeParse(firstItem).success,
        "la tarjeta de beneficio recortada vuelve a validar contra el schema real persistido (benefitItemSchema)"
      );
    }
  }

  // ── [3] Visual direction plan: prompt largo nunca comparte el límite de 240 ─
  console.log("\n[3] Prompt visual extenso: nunca se rechaza por compartir el límite corto de 240");
  {
    const draft: AIProductDraft = {
      name: "Magnesio Triple Absorción 400mg",
      slug: "magnesio-triple-absorcion-400mg",
      category: "Suplementos",
      tags: [],
      descriptionHtml: "<p>Combina tres formas de magnesio.</p>",
      productSections: [
        { id: "sec-usage", type: "usage", enabled: true, order: 0, data: { heading: "Cómo tomarlo", description: "", image_url: "", alt: undefined } },
      ],
      galleryImageUrls: [IMG(1)],
      detectedFacts: [],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
      ignoredSupplierLines: [],
      meta: { mode: "ai", generatedAt: "2026-01-01T00:00:00.000Z", model: "gpt-5.6-terra", warnings: [] },
    };

    const longPrompt =
      "Muestra el envase del suplemento de magnesio sobre una mesa de madera clara, junto a un vaso de agua, en una cocina luminosa y ordenada durante la mañana; mantén exactamente el diseño, colores, tipografía, etiqueta y forma real del envase de la foto de referencia, sin alterar ninguna proporción ni ángulo del producto, sin agregar texto nuevo, sin inventar sellos ni certificaciones que no existan en la foto original, y sin cambiar el color de la etiqueta original bajo ninguna circunstancia, priorizando una composición cálida, minimalista y luminosa que transmita bienestar diario y constancia en la rutina matutina de la persona que lo consume";
    assert(longPrompt.length > 600 && longPrompt.length <= 1200, "el prompt de prueba supera el límite viejo (600) pero cabe en el nuevo (1200)");

    const client = makePlanMockClient({
      classifications: [{ imageId: "image_1", category: "clean_cover", reason: "Producto solo, fondo limpio." }],
      coverImageId: "image_1",
      coverReason: "Portada limpia real.",
      galleryOrder: ["image_1"],
      sections: [
        {
          sectionIndex: 1,
          imageId: null,
          assignmentReason: "",
          needsGeneration: true,
          generationIntent: "lifestyle_context",
          generationPrompt: longPrompt,
          generationPersuasiveGoal: "Transmitir un momento de bienestar diario real",
          generationRisks: ["No inventar certificaciones ni dosis distintas a las indicadas"],
        },
      ],
    });

    const result = await withEnv(BASE_ENV, () =>
      generateVisualDirectionPlan(draft, [IMG(1)], { client, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(result.ok, `el plan se genera exitosamente con un prompt largo (obtuvo: ${result.ok ? "ok" : result.error})`);
    if (result.ok) {
      const usageSection = result.plan.sections.find((s) => s.sectionId === "sec-usage");
      assert(usageSection?.generationProposal?.promptDraft === longPrompt, "el prompt largo llega completo, sin recortar ni un carácter");
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} aserción(es) fallaron.`);
    process.exitCode = 1;
  } else {
    console.log("\nTodas las aserciones pasaron. Nunca se llamó a OpenAI real ni se tocó Neon/R2/productos.");
    process.exitCode = 0;
  }
}

main().catch((error) => {
  console.error("\n[verify-ai-studio-field-limits] Error:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
