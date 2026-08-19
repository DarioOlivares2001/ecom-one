/**
 * Prueba de la detección de medidas visibles DENTRO de imágenes del
 * proveedor (cotas impresas en un diagrama técnico, ej. "17 cm", "10,5 cm",
 * "5 cm") — el bug concreto: el asistente no creaba un bloque "Medidas"
 * aunque la imagen subida traía cotas claras, porque el pipeline solo
 * miraba `supplierText`.
 *
 * Dos partes:
 *  [0] Unidades puras de `lib/ai-product-studio/imageMeasurements.ts` — sin
 *      red, sin OpenAI, sin `generateAIDraft.ts`.
 *  [1+] Integración con `generateAIDraft.ts` (mismo patrón que
 *      `verify-ai-product-studio-openai.ts`: cliente OpenAI 100% mock,
 *      nunca se llama a la red real ni se gasta cuota).
 *
 * No toca Neon/R2/productos/pedidos reales en ningún caso.
 *
 * Uso: npx tsx --conditions=react-server scripts/verify-ai-studio-image-measurements.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import {
  demoteMeasurementCoverImage,
  extractMeasurementTokensFromText,
  isValidMeasurementToken,
  measurementSetsMatch,
  sanitizeMeasurementValues,
} from "../lib/ai-product-studio/imageMeasurements";
import { generateAIDraft, type AIProductStudioOpenAIClient } from "../lib/ai-product-studio/generateAIDraft";
import type { AIProductStudioInput } from "../lib/ai-product-studio/schema";

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

function makeMockClient(outputObj: unknown): AIProductStudioOpenAIClient {
  return {
    responses: {
      async create() {
        return { output_text: JSON.stringify(outputObj) };
      },
    },
  };
}

const BASE_ENV = { AI_PRODUCT_STUDIO_ENABLED: "true", OPENAI_API_KEY: "sk-test-fake" };

async function main() {
  // ── [0] Unidades puras: imageMeasurements.ts ──────────────────────────────
  console.log("[0] Unidades puras de lib/ai-product-studio/imageMeasurements.ts");
  {
    assert(isValidMeasurementToken("17 cm"), '"17 cm" es una medida válida');
    assert(isValidMeasurementToken("10,5 cm"), '"10,5 cm" (coma decimal) es una medida válida');
    assert(isValidMeasurementToken("29 x 22 x 10 cm"), '"29 x 22 x 10 cm" (trío) es una medida válida');
    assert(isValidMeasurementToken("29×22×10 cm"), '"29×22×10 cm" (símbolo ×) es una medida válida');
    assert(!isValidMeasurementToken("aprox 17 cm"), 'texto extra alrededor ("aprox 17 cm") NO es válido');
    assert(!isValidMeasurementToken("17"), 'un número sin unidad NO es válido');
    assert(!isValidMeasurementToken("mucho"), 'texto sin números NO es válido');

    const sanitized = sanitizeMeasurementValues(["17 cm", "10,5 cm", "5 cm", "no es una medida", "17 cm"]);
    assert(
      JSON.stringify(sanitized) === JSON.stringify(["17 cm", "10,5 cm", "5 cm"]),
      `sanitizeMeasurementValues descarta lo inválido y deduplica (obtuvo: ${JSON.stringify(sanitized)})`
    );

    const tokensFromText = extractMeasurementTokensFromText("Mide 29 x 22 x 10 cm aproximadamente.");
    assert(
      tokensFromText.some((t) => t.toLowerCase().includes("29")),
      `extractMeasurementTokensFromText encuentra el trío en texto libre (obtuvo: ${JSON.stringify(tokensFromText)})`
    );
    assert(
      extractMeasurementTokensFromText("Sin ninguna cifra aquí.").length === 0,
      "extractMeasurementTokensFromText no encuentra nada si no hay medidas"
    );

    assert(
      measurementSetsMatch(["29 x 22 x 10 cm"], ["29 x 22 x 10 cm"]),
      "measurementSetsMatch: mismo trío, mismo texto -> coincide"
    );
    assert(
      measurementSetsMatch(["29 x 22 x 10 cm"], ["29x22x10cm"]),
      "measurementSetsMatch ignora espacios/símbolo x vs × al comparar"
    );
    assert(
      measurementSetsMatch(["10,5 cm"], ["10.5 cm"]),
      "measurementSetsMatch trata coma y punto decimal como el mismo valor"
    );
    assert(
      !measurementSetsMatch(["17 cm"], ["18 cm"]),
      "measurementSetsMatch: valores distintos -> NO coincide"
    );
    assert(!measurementSetsMatch([], ["17 cm"]), "measurementSetsMatch: un lado vacío nunca 'coincide' (evita falso positivo)");

    const demote = demoteMeasurementCoverImage([IMG(1), IMG(2), IMG(3)], new Set([IMG(1)]));
    assert(demote.changed, "demoteMeasurementCoverImage cambia el orden cuando la portada es la imagen de medidas");
    assert(
      JSON.stringify(demote.urls) === JSON.stringify([IMG(2), IMG(1), IMG(3)]),
      `demoteMeasurementCoverImage intercambia solo portada <-> primera no-medidas (obtuvo: ${JSON.stringify(demote.urls)})`
    );

    const keepGallery = demoteMeasurementCoverImage([IMG(2), IMG(1), IMG(3)], new Set([IMG(1)]));
    assert(!keepGallery.changed, "demoteMeasurementCoverImage no toca nada si la portada YA no es la imagen de medidas");

    const allMeasurements = demoteMeasurementCoverImage([IMG(1), IMG(2)], new Set([IMG(1), IMG(2)]));
    assert(
      !allMeasurements.changed,
      "demoteMeasurementCoverImage no puede reordenar si TODAS las imágenes son de medidas (no hay a qué promover)"
    );
  }

  // ── [1] Texto explícito sigue funcionando (regla previa intacta) ───────────
  console.log('\n[1] Medidas explícitas SOLO en el texto del proveedor: sigue creando el bloque como antes');
  {
    const input: AIProductStudioInput = {
      supplierText: "Molino Eléctrico para Café y Granos\n- Molienda uniforme\nMedidas: 20 x 15 x 30 cm",
      selectedImages: [IMG(1)],
      tone: "directo",
    };
    const client = makeMockClient({
      name: "Molino Eléctrico para Café y Granos",
      category: "",
      tags: [],
      descriptionHtml: "<p>Muele tus granos de forma uniforme.</p>",
      productSections: [],
      galleryImageIds: ["image_1"],
      detectedFacts: [],
      imageMeasurements: [],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
    });
    const result = await withEnv(BASE_ENV, () => generateAIDraft(input, { client, generatedAt: "2026-01-01T00:00:00.000Z" }));
    assert(result.ok, "generación exitosa");
    if (result.ok) {
      const measurementsSection = result.draft.productSections.find((s) => s.type === "measurements");
      assert(Boolean(measurementsSection), 'se generó un bloque "measurements" a partir del texto (comportamiento previo intacto)');
      assert(
        measurementsSection?.type === "measurements" && measurementsSection.data.description?.includes("20 x 15 x 30 cm"),
        "el bloque contiene las dimensiones reales del texto"
      );
    }
  }

  // ── [2] Imagen con 17 cm, 10,5 cm y 5 cm: crea el bloque, imagen correcta, copy prudente ──
  console.log('\n[2] Imagen con cotas "17 cm", "10,5 cm" y "5 cm": genera bloque measurements con esa imagen y texto prudente');
  {
    const input: AIProductStudioInput = {
      supplierText: "Molino Eléctrico para Café y Granos\n- Molienda uniforme\n- Fácil de limpiar",
      selectedImages: [IMG(1), IMG(2)],
      tone: "directo",
    };
    const client = makeMockClient({
      name: "Molino Eléctrico para Café y Granos",
      category: "",
      tags: [],
      descriptionHtml: "<p>Muele tus granos de forma uniforme y es fácil de limpiar.</p>",
      productSections: [],
      galleryImageIds: ["image_1", "image_2"],
      detectedFacts: [],
      imageMeasurements: [{ imageId: "image_2", values: ["17 cm", "10,5 cm", "5 cm"], clear: true }],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
    });
    const result = await withEnv(BASE_ENV, () => generateAIDraft(input, { client, generatedAt: "2026-01-01T00:00:00.000Z" }));
    assert(result.ok, "generación exitosa");
    if (result.ok) {
      const measurementsSection = result.draft.productSections.find((s) => s.type === "measurements");
      assert(Boolean(measurementsSection), 'se creó un bloque "measurements" a partir de la imagen (el bug reportado)');
      assert(
        measurementsSection?.type === "measurements" && measurementsSection.data.image_url === IMG(2),
        `el bloque usa EXACTAMENTE la imagen que trae las cotas (obtuvo: "${measurementsSection?.type === "measurements" ? measurementsSection.data.image_url : "-"}")`
      );
      const desc = measurementsSection?.type === "measurements" ? (measurementsSection.data.description ?? "") : "";
      assert(desc.includes("17 cm") && desc.includes("10,5 cm") && desc.includes("5 cm"), `el texto incluye las 3 cifras tal como vienen (obtuvo: "${desc}")`);
      assert(
        desc.startsWith("Las medidas indicadas en la imagen del proveedor son:"),
        `el copy es prudente, con la fórmula exacta pedida (obtuvo: "${desc}")`
      );
      assert(
        !desc.toLowerCase().includes("ancho") &&
          !desc.toLowerCase().includes("alto") &&
          !desc.toLowerCase().includes("largo") &&
          !desc.toLowerCase().includes("profundidad"),
        "el copy NO inventa a qué corresponde cada número (sin ancho/alto/largo/profundidad)"
      );
      assert(
        !desc.toLowerCase().includes("kg") && !desc.toLowerCase().includes("watt") && !desc.toLowerCase().includes("litro"),
        "el copy NO asume peso, potencia ni capacidad"
      );
      const heading = measurementsSection?.type === "measurements" ? measurementsSection.data.heading : undefined;
      assert(
        heading === "Medidas del producto" || heading === "Medidas referenciales",
        `el título es uno de los dos prudentes permitidos (obtuvo: "${heading}")`
      );

      const factsFromImage = result.draft.detectedFacts.filter((f) => f.source === "supplier_image");
      assert(factsFromImage.length > 0, 'se agregó un detectedFact con source "supplier_image"');
      assert(
        factsFromImage.some((f) => f.confidence === "confirmed" && f.imageUrl === IMG(2)),
        "el detectedFact indica confidence 'confirmed' y la imagen fuente exacta"
      );
      assert(
        factsFromImage.some((f) => f.value?.includes("17 cm")),
        "el detectedFact trae el valor literal detectado"
      );
    }
  }

  // ── [3] Imagen sin números: NO genera Medidas ──────────────────────────────
  console.log("\n[3] Imagen sin cotas visibles: NO genera un bloque Medidas");
  {
    const input: AIProductStudioInput = {
      supplierText: "Molino Eléctrico para Café y Granos\n- Molienda uniforme",
      selectedImages: [IMG(1), IMG(2)],
      tone: "directo",
    };
    const client = makeMockClient({
      name: "Molino Eléctrico para Café y Granos",
      category: "",
      tags: [],
      descriptionHtml: "<p>Muele tus granos de forma uniforme.</p>",
      productSections: [],
      galleryImageIds: ["image_1", "image_2"],
      detectedFacts: [],
      imageMeasurements: [],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
    });
    const result = await withEnv(BASE_ENV, () => generateAIDraft(input, { client, generatedAt: "2026-01-01T00:00:00.000Z" }));
    assert(result.ok, "generación exitosa");
    if (result.ok) {
      assert(
        !result.draft.productSections.some((s) => s.type === "measurements"),
        "sin cotas en ninguna imagen ni dimensiones en el texto -> no se inventa un bloque Medidas"
      );
    }
  }

  // ── [4] Lectura ambigua: needs_review, nunca crea el bloque ────────────────
  console.log('\n[4] Imagen con posibles medidas pero lectura no clara ("clear": false): no crea el bloque, queda "Por confirmar"');
  {
    const input: AIProductStudioInput = {
      supplierText: "Molino Eléctrico para Café y Granos\n- Molienda uniforme",
      selectedImages: [IMG(1), IMG(2)],
      tone: "directo",
    };
    const client = makeMockClient({
      name: "Molino Eléctrico para Café y Granos",
      category: "",
      tags: [],
      descriptionHtml: "<p>Muele tus granos de forma uniforme.</p>",
      productSections: [],
      galleryImageIds: ["image_1", "image_2"],
      detectedFacts: [],
      imageMeasurements: [{ imageId: "image_2", values: ["17 cm"], clear: false }],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
    });
    const result = await withEnv(BASE_ENV, () => generateAIDraft(input, { client, generatedAt: "2026-01-01T00:00:00.000Z" }));
    assert(result.ok, "generación exitosa");
    if (result.ok) {
      assert(
        !result.draft.productSections.some((s) => s.type === "measurements"),
        'lectura no confirmada ("clear": false) -> NO se crea el bloque automáticamente'
      );
      const fact = result.draft.detectedFacts.find((f) => f.source === "supplier_image");
      assert(Boolean(fact), "igual se informa como detectedFact para que el admin lo revise");
      assert(fact?.confidence === "needs_review", `el fact queda marcado 'needs_review' / Por confirmar (obtuvo: "${fact?.confidence}")`);
    }

    // Ninguna medida legible ("clear": false y sin valores) -> ni siquiera hay cifra que mostrar, tampoco bloque.
    const clientNoValues = makeMockClient({
      name: "Molino Eléctrico para Café y Granos",
      category: "",
      tags: [],
      descriptionHtml: "<p>Muele tus granos de forma uniforme.</p>",
      productSections: [],
      galleryImageIds: ["image_1", "image_2"],
      detectedFacts: [],
      imageMeasurements: [{ imageId: "image_2", values: [], clear: false }],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
    });
    const resultNoValues = await withEnv(BASE_ENV, () =>
      generateAIDraft(input, { client: clientNoValues, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(resultNoValues.ok, "generación exitosa (sin valores legibles)");
    if (resultNoValues.ok) {
      assert(
        !resultNoValues.draft.productSections.some((s) => s.type === "measurements"),
        "sin ningún valor legible -> tampoco se crea el bloque ni se inventa una cifra"
      );
    }
  }

  // ── [5] Conflicto texto vs. imagen: advertencia, sin afirmación definitiva ─
  console.log("\n[5] Medidas del texto y de una imagen NO coinciden: advertencia de revisión, sin decidir cuál es correcta");
  {
    const input: AIProductStudioInput = {
      supplierText: "Molino Eléctrico para Café y Granos\n- Molienda uniforme\nMedidas: 20 x 15 x 30 cm",
      selectedImages: [IMG(1), IMG(2)],
      tone: "directo",
    };
    const client = makeMockClient({
      name: "Molino Eléctrico para Café y Granos",
      category: "",
      tags: [],
      descriptionHtml: "<p>Muele tus granos de forma uniforme.</p>",
      productSections: [
        {
          type: "measurements",
          data: { heading: "Medidas", description: "Mide 20 x 15 x 30 cm.", imageId: "image_1", alt: "" },
        },
      ],
      galleryImageIds: ["image_1", "image_2"],
      detectedFacts: [],
      imageMeasurements: [{ imageId: "image_2", values: ["17 cm", "10,5 cm", "5 cm"], clear: true }],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
    });
    const result = await withEnv(BASE_ENV, () => generateAIDraft(input, { client, generatedAt: "2026-01-01T00:00:00.000Z" }));
    assert(result.ok, "generación exitosa");
    if (result.ok) {
      const sections = result.draft.productSections.filter((s) => s.type === "measurements");
      assert(sections.length === 1, `no se duplica el bloque "Medidas" aunque texto e imagen difieran (obtuvo ${sections.length} bloques)`);
      assert(
        sections[0]?.type === "measurements" && sections[0].data.description === "Mide 20 x 15 x 30 cm.",
        "el bloque del texto queda SIN modificar (no se decide cuál valor es el correcto)"
      );
      assert(
        result.draft.meta.warnings.some((w) => w.includes("distintas") && w.includes("20 x 15 x 30 cm") && w.includes("17 cm")),
        "se deja una advertencia explícita mencionando ambos conjuntos de valores"
      );
      assert(
        !result.draft.meta.warnings.some((w) => w.toLowerCase().includes("correcta es") || w.toLowerCase().includes("la correcta")),
        "la advertencia nunca afirma cuál de las dos medidas es la correcta"
      );
    }
  }

  // ── [5b] Coinciden exactamente: se unifica (misma sección, imagen de cotas como referencia) ──
  console.log("\n[5b] Medidas del texto y de la imagen COINCIDEN exactamente: se unifica en un solo bloque, usando la imagen de cotas");
  {
    const input: AIProductStudioInput = {
      supplierText: "Molino Eléctrico para Café y Granos\nMedidas: 20 x 15 x 30 cm",
      selectedImages: [IMG(1), IMG(2)],
      tone: "directo",
    };
    const client = makeMockClient({
      name: "Molino Eléctrico para Café y Granos",
      category: "",
      tags: [],
      descriptionHtml: "<p>Muele tus granos de forma uniforme.</p>",
      productSections: [
        {
          type: "measurements",
          data: { heading: "Medidas", description: "Mide 20 x 15 x 30 cm.", imageId: "image_1", alt: "" },
        },
      ],
      galleryImageIds: ["image_1", "image_2"],
      detectedFacts: [],
      imageMeasurements: [{ imageId: "image_2", values: ["20 x 15 x 30 cm"], clear: true }],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
    });
    const result = await withEnv(BASE_ENV, () => generateAIDraft(input, { client, generatedAt: "2026-01-01T00:00:00.000Z" }));
    assert(result.ok, "generación exitosa");
    if (result.ok) {
      const sections = result.draft.productSections.filter((s) => s.type === "measurements");
      assert(sections.length === 1, `un único bloque "Medidas" cuando los valores coinciden (obtuvo ${sections.length})`);
      assert(
        sections[0]?.type === "measurements" && sections[0].data.image_url === IMG(2),
        "se usa la imagen de las cotas como referencia visual al unificar"
      );
    }
  }

  // ── [6] Dos imágenes con medidas: nunca mezclar cifras entre ellas ─────────
  console.log("\n[6] Dos imágenes con medidas detectadas: no se mezclan números entre ellas");
  {
    const input: AIProductStudioInput = {
      supplierText: "Molino Eléctrico para Café y Granos\n- Molienda uniforme",
      selectedImages: [IMG(1), IMG(2), IMG(3)],
      tone: "directo",
    };
    const client = makeMockClient({
      name: "Molino Eléctrico para Café y Granos",
      category: "",
      tags: [],
      descriptionHtml: "<p>Muele tus granos de forma uniforme.</p>",
      productSections: [],
      galleryImageIds: ["image_1", "image_2", "image_3"],
      detectedFacts: [],
      imageMeasurements: [
        { imageId: "image_2", values: ["17 cm", "10,5 cm", "5 cm"], clear: true },
        { imageId: "image_3", values: ["40 cm"], clear: true },
      ],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
    });
    const result = await withEnv(BASE_ENV, () => generateAIDraft(input, { client, generatedAt: "2026-01-01T00:00:00.000Z" }));
    assert(result.ok, "generación exitosa");
    if (result.ok) {
      const sections = result.draft.productSections.filter((s) => s.type === "measurements");
      assert(sections.length === 1, `se crea un solo bloque, nunca uno por cada imagen (obtuvo ${sections.length})`);
      const desc = sections[0]?.type === "measurements" ? (sections[0].data.description ?? "") : "";
      assert(
        (desc.includes("17 cm") && !desc.includes("40 cm")) || (desc.includes("40 cm") && !desc.includes("17 cm")),
        `el bloque usa SOLO los valores de una imagen, nunca combina ambas (obtuvo: "${desc}")`
      );
      assert(
        result.draft.meta.warnings.some((w) => w.includes("más de una imagen")),
        "se avisa que había más de una imagen con medidas y que se usó solo una"
      );
      // Los detectedFacts sí reportan AMBAS imágenes por separado (para que el admin las vea todas).
      const imageFacts = result.draft.detectedFacts.filter((f) => f.source === "supplier_image");
      assert(imageFacts.length === 2, `detectedFacts SÍ lista ambas imágenes por separado, sin mezclarlas (obtuvo ${imageFacts.length})`);
    }
  }

  // ── [7] Portada: nunca una imagen técnica de medidas si hay otra disponible ─
  console.log("\n[7] Una imagen técnica de medidas no se usa/reordena como portada automáticamente si hay otra disponible");
  {
    const input: AIProductStudioInput = {
      supplierText: "Molino Eléctrico para Café y Granos\n- Molienda uniforme",
      selectedImages: [IMG(1), IMG(2)],
      tone: "directo",
    };
    // El modelo propone la imagen de medidas (image_1) primero en la galería.
    const client = makeMockClient({
      name: "Molino Eléctrico para Café y Granos",
      category: "",
      tags: [],
      descriptionHtml: "<p>Muele tus granos de forma uniforme.</p>",
      productSections: [],
      galleryImageIds: ["image_1", "image_2"],
      detectedFacts: [],
      imageMeasurements: [{ imageId: "image_1", values: ["17 cm", "10,5 cm", "5 cm"], clear: true }],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
    });
    const result = await withEnv(BASE_ENV, () => generateAIDraft(input, { client, generatedAt: "2026-01-01T00:00:00.000Z" }));
    assert(result.ok, "generación exitosa");
    if (result.ok) {
      assert(
        result.draft.galleryImageUrls[0] === IMG(2),
        `la portada NUNCA queda como la imagen técnica de medidas cuando hay otra disponible (obtuvo: "${result.draft.galleryImageUrls[0]}")`
      );
      assert(
        result.draft.galleryImageUrls.includes(IMG(1)),
        "la imagen de medidas SIGUE en la galería (nunca se elimina, solo se reordena)"
      );
      assert(
        JSON.stringify([...result.draft.galleryImageUrls].sort()) === JSON.stringify([IMG(1), IMG(2)].sort()),
        "el conjunto de imágenes de la galería no cambia, solo el orden"
      );
      assert(
        result.draft.meta.warnings.some((w) => w.toLowerCase().includes("portada")),
        "se deja constancia visible del cambio de portada en las advertencias"
      );
    }

    // Si TODAS las imágenes seleccionadas son de medidas, no hay a qué "priorizar": se deja como está, sin reventar.
    const inputAllMeasurements: AIProductStudioInput = {
      supplierText: "Molino Eléctrico para Café y Granos",
      selectedImages: [IMG(1)],
      tone: "directo",
    };
    const clientAllMeasurements = makeMockClient({
      name: "Molino Eléctrico para Café y Granos",
      category: "",
      tags: [],
      descriptionHtml: "<p>Muele tus granos.</p>",
      productSections: [],
      galleryImageIds: ["image_1"],
      detectedFacts: [],
      imageMeasurements: [{ imageId: "image_1", values: ["17 cm"], clear: true }],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
    });
    const resultAllMeasurements = await withEnv(BASE_ENV, () =>
      generateAIDraft(inputAllMeasurements, { client: clientAllMeasurements, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(resultAllMeasurements.ok, "generación exitosa (única imagen, y es de medidas)");
    if (resultAllMeasurements.ok) {
      assert(
        JSON.stringify(resultAllMeasurements.draft.galleryImageUrls) === JSON.stringify([IMG(1)]),
        "con una sola imagen (de medidas) no hay nada que reordenar, y no revienta"
      );
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} aserción(es) fallaron.`);
    process.exitCode = 1;
  } else {
    console.log("\nTodas las aserciones pasaron. Nunca se llamó a OpenAI real (cliente 100% mock) ni se tocó Neon/R2/productos/pedidos.");
    process.exitCode = 0;
  }
}

main().catch((error) => {
  console.error("\n[verify-ai-studio-image-measurements] Error:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
