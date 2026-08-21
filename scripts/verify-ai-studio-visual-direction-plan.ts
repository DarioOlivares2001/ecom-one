/**
 * "Dirección visual de ficha" (`generateVisualDirectionPlan.ts`) — reemplaza
 * la auditoría plana anterior después de que una prueba real con un TALADRO
 * mostró fallas concretas: la IA eligió como portada una gráfica
 * promocional con texto ("Design leve"), la repitió en Beneficios y Uso, y
 * no había ningún criterio editorial de conversión. Este script prueba
 * exactamente esos escenarios, más las reglas duras generales.
 *
 * Cliente de OpenAI 100% mock (mismo patrón que el resto del Estudio IA) —
 * nunca llama a la red real ni gasta cuota, nunca toca Neon/R2/productos.
 *
 * Uso: npx tsx --conditions=react-server scripts/verify-ai-studio-visual-direction-plan.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import {
  generateVisualDirectionPlan,
  type VisualDirectionOpenAIClient,
} from "../lib/ai-product-studio/visualEnhancement/generateVisualDirectionPlan";
import type { AIProductDraft } from "../lib/ai-product-studio/schema";

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
// Fotos del caso real del taladro:
const GRAPHIC = IMG(1); // "Design leve" — gráfica promocional con texto grande
const CLEAN = IMG(2); // foto limpia del producto, protagonista
const KIT = IMG(3); // maletín con accesorios
const MEASUREMENTS_PHOTO = IMG(4); // diagrama técnico con cotas
const DETAIL = IMG(5); // acercamiento/detalle

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

const BASE_ENV = { AI_PRODUCT_STUDIO_ENABLED: "true", OPENAI_API_KEY: "sk-test-fake" };

function makeMockClient(outputObj: unknown): VisualDirectionOpenAIClient {
  return {
    responses: {
      async create() {
        return { output_text: JSON.stringify(outputObj) };
      },
    },
  };
}

/** Borrador base "Taladro Inalámbrico con Maletín" — 4 secciones reales + la galería (índice 0, implícita). */
function taladroDraft(): AIProductDraft {
  return {
    name: "Taladro Inalámbrico con Maletín",
    slug: "taladro-inalambrico-con-maletin",
    category: "Herramientas",
    tags: [],
    descriptionHtml: "<p>Taladro inalámbrico potente, listo para el hogar y el taller.</p>",
    productSections: [
      { id: "sec-benefits", type: "benefits", enabled: true, order: 0, data: { heading: "Beneficios", image_url: "", items: [{ icon: "check", title: "Ligero", description: "Fácil de manejar por horas" }] } },
      { id: "sec-usage", type: "usage", enabled: true, order: 1, data: { heading: "Cómo usarlo", description: "", image_url: "", alt: undefined } },
      { id: "sec-measurements", type: "measurements", enabled: true, order: 2, data: { heading: "Medidas", description: "", image_url: "", alt: undefined } },
      { id: "sec-versatility", type: "versatility", enabled: true, order: 3, data: { heading: "Kit organizado para transportar", description: "", image_url: "", alt: undefined } },
    ],
    galleryImageUrls: [GRAPHIC, CLEAN, KIT, MEASUREMENTS_PHOTO, DETAIL],
    detectedFacts: [],
    claimsToAvoid: [],
    fieldsNeedingConfirmation: [],
    ignoredSupplierLines: [],
    meta: { mode: "ai", generatedAt: "2026-01-01T00:00:00.000Z", model: "gpt-5.6-terra", warnings: [] },
  };
}

const ALL_PHOTOS = [GRAPHIC, CLEAN, KIT, MEASUREMENTS_PHOTO, DETAIL];

function baseClassifications() {
  return [
    { imageId: "image_1", category: "promotional_graphic", reason: "Texto grande 'Design leve' cubre el producto." },
    { imageId: "image_2", category: "clean_cover", reason: "Producto solo, fondo limpio, sin texto." },
    { imageId: "image_3", category: "kit_accessories", reason: "Maletín con accesorios ordenados." },
    { imageId: "image_4", category: "measurements", reason: "Diagrama técnico con cotas." },
    { imageId: "image_5", category: "detail", reason: "Acercamiento a un control del producto." },
  ];
}

async function main() {
  // ── [1] Portada: la gráfica promocional NUNCA gana, aunque el modelo la proponga ──
  console.log('[1] Taladro: "Design leve" (gráfica promocional) nunca puede quedar de portada, aunque el modelo la proponga');
  {
    const client = makeMockClient({
      classifications: baseClassifications(),
      coverImageId: "image_1", // el modelo insiste en la gráfica
      coverReason: "Es la imagen más llamativa.",
      galleryOrder: ["image_1", "image_2", "image_3"],
      sections: [],
    });
    const result = await withEnv(BASE_ENV, () =>
      generateVisualDirectionPlan(taladroDraft(), ALL_PHOTOS, { client, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(result.ok, `plan generado exitosamente (obtuvo: ${result.ok ? "ok" : result.error})`);
    if (result.ok) {
      assert(result.plan.gallery.coverUrl !== GRAPHIC, "la portada NUNCA es la gráfica promocional");
      assert(result.plan.gallery.coverUrl === CLEAN, `cae de vuelta a la foto limpia real (obtuvo: "${result.plan.gallery.coverUrl}")`);
      assert(
        result.plan.warnings.some((w) => w.toLowerCase().includes("portada") && w.toLowerCase().includes("descart")),
        "se avisa que se descartó la portada propuesta por el modelo"
      );
      assert(
        result.plan.gallery.discarded.some((d) => d.url === GRAPHIC && d.category === "promotional_graphic"),
        "la gráfica queda en 'descartadas' con su categoría real"
      );
      assert(!result.plan.gallery.recommendedOrder.includes(GRAPHIC), "la gráfica NUNCA entra a la galería recomendada");
    }
  }

  // ── [2] Ninguna foto apta para portada -> "Portada por confirmar", nunca una mala elección automática ──
  console.log('\n[2] Sin ninguna foto "portada limpia"/"producto en uso": queda "Portada por confirmar", nunca se elige una mala automáticamente');
  {
    const client = makeMockClient({
      classifications: [
        { imageId: "image_1", category: "promotional_graphic", reason: "Gráfica con texto." },
        { imageId: "image_3", category: "kit_accessories", reason: "Maletín." },
        { imageId: "image_4", category: "measurements", reason: "Diagrama con cotas." },
      ],
      coverImageId: null,
      coverReason: "Ninguna foto es una portada limpia o de uso real.",
      galleryOrder: [],
      sections: [],
    });
    const result = await withEnv(BASE_ENV, () =>
      generateVisualDirectionPlan(taladroDraft(), [GRAPHIC, KIT, MEASUREMENTS_PHOTO], { client, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(result.ok, "generación exitosa (sin portada apta)");
    if (result.ok) {
      assert(result.plan.gallery.coverUrl === null, "coverUrl es null — 'Portada por confirmar'");
      assert(result.plan.gallery.coverReason === null, "coverReason también es null (no se inventa una razón para una portada inexistente)");
      assert(
        result.plan.warnings.some((w) => w.toLowerCase().includes("portada por confirmar")),
        "se avisa explícitamente 'Portada por confirmar'"
      );
      const gallerySection = result.plan.sections.find((s) => s.sectionId === "gallery");
      assert(gallerySection?.needsGeneration === true, "la 'sección' de galería queda marcada needsGeneration (para poder generar una portada)");
      assert(
        Boolean(gallerySection?.generationProposal) && gallerySection?.generationProposal?.referenceImageUrl !== GRAPHIC,
        "la propuesta de generación para portada NUNCA usa la gráfica promocional como referencia"
      );
    }
  }

  // ── [3] No repetición: la misma imagen nunca queda asignada a dos secciones ──
  console.log("\n[3] Dedup: si el modelo propone la MISMA imagen para dos secciones, la segunda no la repite");
  {
    const client = makeMockClient({
      classifications: baseClassifications(),
      coverImageId: "image_2",
      coverReason: "Foto limpia del producto.",
      galleryOrder: ["image_2", "image_3", "image_5"],
      sections: [
        { sectionIndex: 1, imageId: "image_5", assignmentReason: "Detalle del control.", needsGeneration: false, generationIntent: null, generationPrompt: "", generationPersuasiveGoal: "", generationRisks: [] },
        { sectionIndex: 2, imageId: "image_5", assignmentReason: "También sirve para Uso.", needsGeneration: false, generationIntent: null, generationPrompt: "", generationPersuasiveGoal: "", generationRisks: [] },
      ],
    });
    const result = await withEnv(BASE_ENV, () =>
      generateVisualDirectionPlan(taladroDraft(), ALL_PHOTOS, { client, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(result.ok, "generación exitosa (imagen duplicada propuesta)");
    if (result.ok) {
      const benefits = result.plan.sections.find((s) => s.sectionId === "sec-benefits");
      const usage = result.plan.sections.find((s) => s.sectionId === "sec-usage");
      assert(benefits?.assignedImageUrl === DETAIL, "la primera sección (Beneficios) sí recibe la imagen propuesta");
      assert(usage?.assignedImageUrl !== DETAIL, "la segunda sección (Uso) NUNCA repite la misma imagen que Beneficios");
      assert(
        result.plan.warnings.some((w) => w.includes("ya se usó en otra sección")),
        "se avisa explícitamente que se evitó repetir la imagen"
      );
      // Chequeo global: ninguna URL de imagen real se repite entre secciones (excluyendo null).
      const assignedUrls = result.plan.sections.map((s) => s.assignedImageUrl).filter((u): u is string => Boolean(u));
      assert(new Set(assignedUrls).size === assignedUrls.length, "ninguna imagen real queda asignada a más de una sección a la vez");
    }
  }

  // ── [4] La gráfica promocional y el diagrama de medidas nunca se asignan a ninguna sección ──
  console.log("\n[4] Gráfica promocional y diagrama de medidas: nunca se asignan a una sección que no sea Medidas");
  {
    const client = makeMockClient({
      classifications: baseClassifications(),
      coverImageId: "image_2",
      coverReason: "Foto limpia.",
      galleryOrder: ["image_2"],
      sections: [
        { sectionIndex: 1, imageId: "image_1", assignmentReason: "Gráfica llamativa.", needsGeneration: false, generationIntent: null, generationPrompt: "", generationPersuasiveGoal: "", generationRisks: [] },
        { sectionIndex: 2, imageId: "image_4", assignmentReason: "Tiene una foto del taladro.", needsGeneration: false, generationIntent: null, generationPrompt: "", generationPersuasiveGoal: "", generationRisks: [] },
      ],
    });
    const result = await withEnv(BASE_ENV, () =>
      generateVisualDirectionPlan(taladroDraft(), ALL_PHOTOS, { client, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(result.ok, "generación exitosa");
    if (result.ok) {
      const benefits = result.plan.sections.find((s) => s.sectionId === "sec-benefits");
      const usage = result.plan.sections.find((s) => s.sectionId === "sec-usage");
      assert(benefits?.assignedImageUrl !== GRAPHIC, "Beneficios nunca recibe la gráfica promocional");
      assert(usage?.assignedImageUrl !== MEASUREMENTS_PHOTO, "Uso nunca recibe el diagrama de medidas");
      assert(
        !result.plan.sections.some((s) => s.sectionType !== "measurements" && s.assignedImageUrl === MEASUREMENTS_PHOTO),
        "el diagrama de medidas jamás aparece asignado fuera del bloque Medidas"
      );
      assert(
        !result.plan.sections.some((s) => s.assignedImageUrl === GRAPHIC),
        "la gráfica promocional jamás queda asignada a NINGUNA sección"
      );
    }
  }

  // ── [5] Medidas: solo una foto real clasificada "measurements"; NUNCA se genera ──
  console.log("\n[5] La sección de Medidas solo acepta una foto real de cotas y nunca recibe una propuesta de generación");
  {
    const client = makeMockClient({
      classifications: baseClassifications(),
      coverImageId: "image_2",
      coverReason: "Foto limpia.",
      galleryOrder: ["image_2"],
      sections: [
        {
          sectionIndex: 3, // measurements
          imageId: null,
          assignmentReason: "",
          needsGeneration: true, // el modelo insiste en generar -> el servidor debe ignorarlo
          generationIntent: "functional_detail",
          generationPrompt: "Genera un diagrama de medidas nuevo",
          generationPersuasiveGoal: "Mostrar medidas",
          generationRisks: [],
        },
      ],
    });
    const result = await withEnv(BASE_ENV, () =>
      generateVisualDirectionPlan(taladroDraft(), ALL_PHOTOS, { client, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(result.ok, "generación exitosa");
    if (result.ok) {
      const measurements = result.plan.sections.find((s) => s.sectionType === "measurements");
      assert(measurements?.assignedImageUrl === MEASUREMENTS_PHOTO, "Medidas recibe la única foto real clasificada 'measurements'");
      assert(measurements?.needsGeneration === false, "needsGeneration se fuerza a false en Medidas, aunque el modelo haya pedido generar");
      assert(measurements?.generationProposal === null, "NUNCA hay una propuesta de generación para Medidas, bajo ninguna circunstancia");
    }

    // Variante: sin ninguna foto real de medidas disponible -> igual sin generar nada.
    const clientNoMeasurementsPhoto = makeMockClient({
      classifications: [
        { imageId: "image_1", category: "promotional_graphic", reason: "Gráfica." },
        { imageId: "image_2", category: "clean_cover", reason: "Limpia." },
      ],
      coverImageId: "image_2",
      coverReason: "Foto limpia.",
      galleryOrder: ["image_2"],
      sections: [
        { sectionIndex: 3, imageId: null, assignmentReason: "", needsGeneration: true, generationIntent: "functional_detail", generationPrompt: "x", generationPersuasiveGoal: "x", generationRisks: [] },
      ],
    });
    const resultNoPhoto = await withEnv(BASE_ENV, () =>
      generateVisualDirectionPlan(taladroDraft(), [GRAPHIC, CLEAN], { client: clientNoMeasurementsPhoto, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(resultNoPhoto.ok, "generación exitosa (sin foto de medidas en absoluto)");
    if (resultNoPhoto.ok) {
      const measurements = resultNoPhoto.plan.sections.find((s) => s.sectionType === "measurements");
      assert(measurements?.assignedImageUrl === null, "Medidas queda sin imagen si no hay ninguna foto real de cotas");
      assert(measurements?.generationProposal === null, "sigue sin proponer generar nada para Medidas, ni con foto ni sin ella");
      assert(
        resultNoPhoto.plan.warnings.some((w) => w.toLowerCase().includes("medidas") && w.toLowerCase().includes("nunca se genera")),
        "se avisa explícitamente que Medidas nunca se genera con IA"
      );
    }
  }

  // ── [6] Escenario completo del taladro: maletín exclusivo + Uso propone lifestyle en vez de reciclar la gráfica ──
  console.log("\n[6] Escenario completo del taladro: maletín solo en Kit organizado, Uso propone una imagen lifestyle real (no la gráfica)");
  {
    const client = makeMockClient({
      classifications: baseClassifications(),
      coverImageId: "image_2",
      coverReason: "Producto solo, fondo limpio, protagonista claro.",
      galleryOrder: ["image_2", "image_3", "image_5"],
      sections: [
        { sectionIndex: 1, imageId: "image_5", assignmentReason: "Detalle real del control.", needsGeneration: false, generationIntent: null, generationPrompt: "", generationPersuasiveGoal: "", generationRisks: [] },
        {
          // Uso: el modelo solo tenía la gráfica como "candidata" (mal propuesta) -> debe rechazarse y proponer generación.
          sectionIndex: 2,
          imageId: "image_1",
          assignmentReason: "Es la única que muestra contexto de uso.",
          needsGeneration: true,
          generationIntent: "lifestyle_context",
          generationPrompt: "Muestra el taladro en uso en un taller doméstico",
          generationPersuasiveGoal: "Transmitir uso real y confianza",
          generationRisks: ["No inventar potencia ni autonomía de batería"],
        },
        { sectionIndex: 3, imageId: "image_4", assignmentReason: "Cotas reales.", needsGeneration: false, generationIntent: null, generationPrompt: "", generationPersuasiveGoal: "", generationRisks: [] },
        { sectionIndex: 4, imageId: "image_3", assignmentReason: "Maletín con accesorios ordenados para transportar.", needsGeneration: false, generationIntent: null, generationPrompt: "", generationPersuasiveGoal: "", generationRisks: [] },
      ],
    });
    const result = await withEnv(BASE_ENV, () =>
      generateVisualDirectionPlan(taladroDraft(), ALL_PHOTOS, { client, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(result.ok, "generación exitosa (escenario completo)");
    if (result.ok) {
      const { plan } = result;

      assert(plan.gallery.coverUrl === CLEAN, "portada = foto limpia real, nunca la gráfica");

      const usage = plan.sections.find((s) => s.sectionId === "sec-usage");
      assert(usage?.assignedImageUrl === null, "Uso NUNCA queda con la gráfica asignada directamente");
      assert(usage?.needsGeneration === true, "Uso queda marcado como necesitando una imagen complementaria");
      assert(
        Boolean(usage?.generationProposal) && usage?.generationProposal?.referenceImageUrl !== GRAPHIC,
        "la propuesta de generación para Uso usa una foto REAL como referencia, nunca la gráfica"
      );
      assert(usage?.generationProposal?.intent === "lifestyle_context", "la propuesta para Uso es del tipo 'Contexto/lifestyle' (no se recicla la gráfica)");

      const versatility = plan.sections.find((s) => s.sectionId === "sec-versatility");
      assert(versatility?.assignedImageUrl === KIT, "el maletín se usa en la sección de kit ('Kit organizado para transportar')");

      const benefits = plan.sections.find((s) => s.sectionId === "sec-benefits");
      assert(benefits?.assignedImageUrl !== KIT, "el maletín NO se repite en Beneficios");
      assert(usage?.assignedImageUrl !== KIT, "el maletín NO se repite en Uso");

      const measurements = plan.sections.find((s) => s.sectionType === "measurements");
      assert(measurements?.assignedImageUrl === MEASUREMENTS_PHOTO, "Medidas usa el diagrama real");

      // Verificación manual pedida: ninguna imagen se repite sin una razón explícita (dedup global).
      const allAssigned = plan.sections.map((s) => s.assignedImageUrl).filter((u): u is string => Boolean(u));
      assert(new Set(allAssigned).size === allAssigned.length, "ninguna imagen real se repite entre secciones en todo el plan");
      assert(!allAssigned.includes(GRAPHIC), '"Design leve" no quedó asignada a ninguna sección del plan final');

      // Fotos y proveedor vs. IA siguen siendo distinguibles: ninguna URL del plan es una URL "generada" (todas son las 5 reales de entrada).
      assert(
        [plan.gallery.coverUrl, ...allAssigned].every((u) => u === null || ALL_PHOTOS.includes(u)),
        "todas las imágenes del plan (portada + secciones) son fotos reales del proveedor — nada generado se auto-aplica"
      );
    }
  }

  // ── [7] Errores claros cuando el estudio está deshabilitado o sin configurar ──
  console.log("\n[7] Errores claros cuando el estudio está deshabilitado o sin configurar");
  {
    const client = makeMockClient({ classifications: [], coverImageId: null, coverReason: "", galleryOrder: [], sections: [] });
    const disabled = await withEnv({ AI_PRODUCT_STUDIO_ENABLED: "false" }, () =>
      generateVisualDirectionPlan(taladroDraft(), ALL_PHOTOS, { client })
    );
    assert(!disabled.ok && disabled.code === "disabled", "AI_PRODUCT_STUDIO_ENABLED=false -> error claro, nunca llama a OpenAI");

    const notConfigured = await withEnv({ AI_PRODUCT_STUDIO_ENABLED: "true", OPENAI_API_KEY: "" }, () =>
      generateVisualDirectionPlan(taladroDraft(), ALL_PHOTOS, { client })
    );
    assert(!notConfigured.ok && notConfigured.code === "not_configured", "sin OPENAI_API_KEY -> error claro, nunca llama a OpenAI");
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
  console.error("\n[verify-ai-studio-visual-direction-plan] Error:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
