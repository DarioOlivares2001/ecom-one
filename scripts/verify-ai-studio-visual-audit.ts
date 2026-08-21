/**
 * Nivel 3 del Estudio IA de Producto ("Mejora visual y persuasiva de la
 * ficha"), paso 1: auditoría visual (`generateVisualAudit.ts`). Cliente de
 * OpenAI 100% mock (mismo patrón que `verify-ai-product-studio-openai.ts`) —
 * nunca llama a la red real ni gasta cuota, nunca toca Neon/R2/productos.
 *
 * Uso: npx tsx --conditions=react-server scripts/verify-ai-studio-visual-audit.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import {
  generateVisualAudit,
  type VisualAuditOpenAIClient,
} from "../lib/ai-product-studio/visualEnhancement/generateVisualAudit";
import { visualAuditSchema } from "../lib/ai-product-studio/visualEnhancement/types";
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

function makeMockClient(outputObj: unknown): { client: VisualAuditOpenAIClient; calls: Record<string, unknown>[] } {
  const calls: Record<string, unknown>[] = [];
  const client: VisualAuditOpenAIClient = {
    responses: {
      async create(params) {
        calls.push(params);
        return { output_text: JSON.stringify(outputObj) };
      },
    },
  };
  return { client, calls };
}

/** Borrador base "Molino Eléctrico para Café y Granos" con un bloque de Medidas ya creado (como lo dejaría el Nivel 2/imageMeasurements) y un bloque de Uso sin imagen. */
function molinoDraft(): AIProductDraft {
  return {
    name: "Molino Eléctrico para Café y Granos",
    slug: "molino-electrico-para-cafe-y-granos",
    category: "Cocina",
    tags: [],
    descriptionHtml: "<p>Muele café y granos de forma pareja.</p>",
    productSections: [
      {
        id: "sec-measurements-1",
        type: "measurements",
        enabled: true,
        order: 0,
        data: {
          heading: "Medidas referenciales",
          description: "Las medidas indicadas en la imagen del proveedor son: 17 cm, 10,5 cm, 5 cm.",
          image_url: IMG(2),
          alt: undefined,
        },
      },
      {
        id: "sec-usage-1",
        type: "usage",
        enabled: true,
        order: 1,
        data: { heading: "Cómo usarlo", description: "", image_url: "", alt: undefined },
      },
    ],
    galleryImageUrls: [IMG(1), IMG(2)],
    detectedFacts: [],
    claimsToAvoid: [],
    fieldsNeedingConfirmation: [],
    ignoredSupplierLines: [],
    meta: { mode: "ai", generatedAt: "2026-01-01T00:00:00.000Z", model: "gpt-5.6-terra", warnings: [] },
  };
}

async function main() {
  // ── [1] Molino: el modelo intenta proponer una imagen generada para Medidas -> el servidor lo impide ──
  console.log("[1] Molino de café: una sección de Medidas NUNCA recibe una acción generativa, aunque el modelo la proponga");
  {
    const { client } = makeMockClient({
      suggestions: [
        {
          // índice 1 = primera sección real (measurements), índice 0 es la galería
          sectionIndex: 1,
          action: "suggest_usage",
          persuasiveGoal: "Mostrar el producto en uso para reforzar confianza",
          referenceImageId: "image_2",
          promptDraft: "Muestra el molino en una cocina, moliendo café",
          risks: ["No mostrar niveles de molienda ni capacidad"],
        },
        {
          sectionIndex: 2, // sección "usage"
          action: "suggest_usage",
          persuasiveGoal: "Mostrar el molino en uso real en una cocina, molienda visible",
          referenceImageId: "image_1",
          promptDraft: "Foto de cocina con el molino en uso, granos visibles cayendo",
          risks: ["No inventar capacidad ni niveles de molienda", "No cambiar el color ni la forma real"],
        },
      ],
    });
    const result = await withEnv(BASE_ENV, () =>
      generateVisualAudit(molinoDraft(), [IMG(1), IMG(2)], { client, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(result.ok, `auditoría generada exitosamente (obtuvo: ${result.ok ? "ok" : result.error})`);
    if (result.ok) {
      const measurementsSuggestion = result.audit.suggestions.find((s) => s.sectionType === "measurements");
      assert(Boolean(measurementsSuggestion), "hay una sugerencia para la sección de Medidas");
      assert(
        measurementsSuggestion?.action === "use_supplier_photo",
        `la acción se forzó a "use_supplier_photo" en vez de generar (obtuvo: "${measurementsSuggestion?.action}")`
      );
      assert(measurementsSuggestion?.promptDraft === null, "no hay prompt de generación para Medidas (no se genera nada)");
      assert(
        measurementsSuggestion?.referenceImageUrl === IMG(2),
        `usa la foto real que YA tenía asignada la sección de Medidas (obtuvo: "${measurementsSuggestion?.referenceImageUrl}")`
      );
      assert(
        result.audit.warnings.some((w) => w.toLowerCase().includes("medidas")),
        "se deja constancia en warnings de que se forzó la regla de Medidas"
      );

      const usageSuggestion = result.audit.suggestions.find((s) => s.sectionType === "usage");
      assert(usageSuggestion?.action === "suggest_usage", "la sección de Uso SÍ conserva la acción generativa propuesta");
      assert(
        usageSuggestion?.referenceImageUrl === IMG(1),
        "la sección de Uso resuelve su imageId a la URL real correspondiente"
      );
      assert(
        usageSuggestion?.risks.some((r) => r.toLowerCase().includes("capacidad")),
        "los riesgos indicados (no inventar capacidad/niveles) se conservan"
      );

      assert(visualAuditSchema.safeParse(result.audit).success, "la auditoría final vuelve a validar contra visualAuditSchema");
    }
  }

  // ── [2] Producto con pocas imágenes: propone, pero NUNCA genera nada automáticamente ──
  console.log("\n[2] Producto sin imágenes de referencia suficientes: propone acciones, pero no se genera ni sube nada");
  {
    const draft: AIProductDraft = {
      ...molinoDraft(),
      productSections: [
        {
          id: "sec-benefits-1",
          type: "benefits",
          enabled: true,
          order: 0,
          data: {
            heading: "Beneficios",
            image_url: "",
            items: [{ icon: "check", title: "Fácil de limpiar", description: "Piezas desmontables" }],
          },
        },
      ],
      galleryImageUrls: [],
    };
    const { client, calls } = makeMockClient({
      suggestions: [
        {
          sectionIndex: 0, // galería
          action: "suggest_lifestyle",
          persuasiveGoal: "Imagen de portada más atractiva",
          referenceImageId: "image_99", // ID inexistente: no se entregó ninguna imagen
          promptDraft: "Ambientación de cocina moderna",
          risks: [],
        },
        {
          sectionIndex: 1,
          action: "suggest_usage",
          persuasiveGoal: "Mostrar el producto en la mesa de una cocina",
          referenceImageId: null,
          promptDraft: "",
          risks: [],
        },
      ],
    });
    const result = await withEnv(BASE_ENV, () =>
      generateVisualAudit(draft, [], { client, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(result.ok, "generación exitosa (sin fotos de referencia)");
    if (result.ok) {
      assert(
        result.audit.suggestions.every((s) => s.action === "no_image_needed"),
        "sin ninguna foto real de referencia válida, toda acción generativa se degrada a 'no_image_needed'"
      );
      assert(
        result.audit.suggestions.every((s) => s.promptDraft === null),
        "ninguna sugerencia queda con un prompt de generación pendiente"
      );
    }
    // La auditoría es SOLO texto (Responses API) — nunca hay una llamada a generación de imágenes acá.
    assert(calls.length === 1, "generar la auditoría hace exactamente 1 llamada a OpenAI (Responses), nunca a Images");
  }

  // ── [3] IDs de imagen desconocidos y sectionIndex desconocido se descartan ──
  console.log("\n[3] Un sectionIndex desconocido se descarta sin reventar; un referenceImageId desconocido nunca se resuelve a una URL");
  {
    const { client } = makeMockClient({
      suggestions: [
        { sectionIndex: 99, action: "no_image_needed", persuasiveGoal: "", referenceImageId: null, promptDraft: "", risks: [] },
        {
          sectionIndex: 0,
          action: "suggest_context",
          persuasiveGoal: "Portada más persuasiva",
          referenceImageId: "image_99",
          promptDraft: "Fondo de cocina cálida",
          risks: [],
        },
      ],
    });
    const result = await withEnv(BASE_ENV, () =>
      generateVisualAudit(molinoDraft(), [IMG(1), IMG(2)], { client, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(result.ok, "generación exitosa (índices inválidos)");
    if (result.ok) {
      assert(result.audit.suggestions.length === 1, "la sugerencia con sectionIndex desconocido se descarta, no revienta");
      assert(
        result.audit.suggestions[0]?.action === "no_image_needed",
        "un referenceImageId desconocido nunca resuelve a una URL -> se degrada a no_image_needed"
      );
      assert(
        result.audit.warnings.some((w) => w.includes("índice")),
        "se avisa del índice de sección desconocido"
      );
    }
  }

  // ── [4] Respeta AI_PRODUCT_STUDIO_ENABLED / OPENAI_API_KEY ──────────────────
  console.log("\n[4] Errores claros cuando el estudio está deshabilitado o sin configurar");
  {
    const { client } = makeMockClient({ suggestions: [] });
    const disabled = await withEnv({ AI_PRODUCT_STUDIO_ENABLED: "false" }, () =>
      generateVisualAudit(molinoDraft(), [IMG(1)], { client })
    );
    assert(!disabled.ok && disabled.code === "disabled", "AI_PRODUCT_STUDIO_ENABLED=false -> error claro, nunca llama a OpenAI");

    const notConfigured = await withEnv({ AI_PRODUCT_STUDIO_ENABLED: "true", OPENAI_API_KEY: "" }, () =>
      generateVisualAudit(molinoDraft(), [IMG(1)], { client })
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
  console.error("\n[verify-ai-studio-visual-audit] Error:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
