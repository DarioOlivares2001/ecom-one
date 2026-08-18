/**
 * Prueba del generador real de IA (`generateAIDraft.ts`) SIN llamar nunca a
 * OpenAI de verdad — se inyecta un cliente mock que solo devuelve texto JSON
 * fijo, así que no se gasta cuota ni se necesita una `OPENAI_API_KEY` válida
 * para correr esto. No toca Neon/R2/productos/pedidos reales en ningún caso.
 *
 * `generateAIDraft.ts` importa "server-only" (mismo patrón que el resto del
 * proyecto) — por eso este script se corre con `--conditions=react-server`,
 * que resuelve ese import al stub vacío sin necesitar el runtime de Next.
 * Ningún otro módulo en esta cadena de imports es Next-específico, así que
 * la condición no rompe nada más (a diferencia de otros módulos del
 * proyecto que si dependen de `next/cache`).
 *
 * Uso: npx tsx --conditions=react-server scripts/verify-ai-product-studio-openai.ts
 */
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";

dotenv.config({ path: ".env.local" });

import { generateAIDraft, type AIProductStudioOpenAIClient } from "../lib/ai-product-studio/generateAIDraft";
import type { AIProductStudioInput } from "../lib/ai-product-studio/schema";
import { aiProductDraftSchema } from "../lib/ai-product-studio/schema";

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

// ── Helpers ────────────────────────────────────────────────────────────────

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

interface CapturedCall {
  params: Record<string, unknown>;
  options?: { timeout?: number };
}

function makeMockClient(outputObj: unknown): { client: AIProductStudioOpenAIClient; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  const client: AIProductStudioOpenAIClient = {
    responses: {
      async create(params, options) {
        calls.push({ params, options });
        return { output_text: JSON.stringify(outputObj) };
      },
    },
  };
  return { client, calls };
}

function promptTextSentToModel(calls: CapturedCall[]): string {
  const params = calls[0]?.params as { input?: Array<{ content?: Array<{ type: string; text?: string }> }> };
  const content = params?.input?.[0]?.content ?? [];
  const textPart = content.find((c) => c.type === "input_text");
  return (textPart?.text ?? "").toLowerCase();
}

async function main() {
  // ── [0] Estado de Neon antes de correr nada — debe seguir igual al final ──
  let productsBefore = -1;
  let ordersBefore = -1;
  if (process.env.DATABASE_URL) {
    const sql = neon(process.env.DATABASE_URL);
    productsBefore = Number((await sql`select count(*) from products`)[0].count);
    ordersBefore = Number((await sql`select count(*) from orders`)[0].count);
  }

  // ── [1] Regresión: secadora portátil — nombre real detectado, specs anclados ─
  console.log('[1] Secadora portátil: nombre real (nunca "Características destacadas"), specs anclados se conservan');
  {
    const supplierText = [
      "Características destacadas",
      "Secadora Portátil de Ropa",
      "- Calienta rápido y seca en minutos",
      "- Ideal para departamentos pequeños",
      "Potencia: 600W",
      "Medidas: 29 x 22 x 10 cm",
      "Incluye temporizador",
      "Enchufe universal incluido",
      "Escríbenos por WhatsApp al +56912345678 para más info",
      "Confirmar inventario antes de comprar",
      "Entrega en 24 horas",
      "Garantía en Dropi",
      "Más info en https://proveedor-externo.cl/secadora",
    ].join("\n");

    const input: AIProductStudioInput = {
      supplierText,
      selectedImages: [IMG(1), IMG(2)],
      tone: "directo",
    };

    const { client, calls } = makeMockClient({
      name: "Secadora Portátil de Ropa",
      category: "",
      tags: [],
      descriptionHtml:
        "<p>Seca tu ropa rápido, ideal para espacios pequeños.</p><p>Potencia 600W, medidas 29 x 22 x 10 cm, con temporizador y enchufe universal.</p>",
      productSections: [
        {
          type: "benefits",
          data: {
            heading: "Beneficios",
            description: "",
            image_url: IMG(1),
            alt: "",
            items: [
              { icon: "clock", title: "Rápida", description: "Seca en minutos" },
              { icon: "package", title: "Compacta", description: "Ideal para espacios pequeños" },
            ],
          },
        },
      ],
      galleryImageUrls: [IMG(1), IMG(2)],
      detectedFacts: [
        { claim: "Potencia 600W", source: "supplier_text" },
        { claim: "Medidas 29 x 22 x 10 cm", source: "supplier_text" },
      ],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
    });

    const result = await withEnv(
      { AI_PRODUCT_STUDIO_ENABLED: "true", OPENAI_API_KEY: "sk-test-fake-key-not-real", AI_PRODUCT_STUDIO_MODEL: undefined },
      () => generateAIDraft(input, { client, generatedAt: "2026-01-01T00:00:00.000Z" })
    );

    assert(result.ok, `generación exitosa (obtuvo: ${result.ok ? "ok" : result.error})`);
    if (result.ok) {
      assert(result.draft.name === "Secadora Portátil de Ropa", `nombre real detectado (obtuvo: "${result.draft.name}")`);
      assert(result.draft.name !== "Características destacadas", 'nombre NUNCA es "Características destacadas"');
      assert(result.draft.slug === "secadora-portatil-de-ropa", `slug derivado en servidor (obtuvo: "${result.draft.slug}")`);

      const fullText = `${result.draft.descriptionHtml} ${JSON.stringify(result.draft.productSections)}`.toLowerCase();
      assert(fullText.includes("600w") || fullText.includes("600 w"), "potencia 600W SE CONSERVA (estaba en el texto del proveedor)");
      assert(fullText.includes("29 x 22 x 10 cm") || fullText.includes("29x22x10cm"), "medidas 29x22x10cm SE CONSERVAN (estaban en el texto)");
      assert(fullText.includes("temporizador"), "temporizador SE CONSERVA (estaba en el texto)");
      assert(fullText.includes("enchufe universal"), "enchufe universal SE CONSERVA (estaba en el texto)");

      assert(!fullText.includes("whatsapp") && !fullText.includes("912345678"), "no incluye WhatsApp/teléfono del proveedor");
      assert(!fullText.includes("confirmar inventario"), 'no incluye "confirmar inventario"');
      assert(!fullText.includes("entrega en 24"), 'no incluye "entrega en 24 horas"');
      assert(!fullText.includes("garantía en dropi") && !fullText.includes("garantia en dropi"), "no incluye la garantía en Dropi");
      assert(!fullText.includes("proveedor-externo.cl"), "no incluye el link externo");

      assert(aiProductDraftSchema.safeParse(result.draft).success, "el borrador final vuelve a validar contra aiProductDraftSchema");
    }

    const promptText = promptTextSentToModel(calls);
    assert(!promptText.includes("whatsapp") && !promptText.includes("912345678"), "el WhatsApp NUNCA llegó al prompt enviado al modelo");
    assert(!promptText.includes("confirmar inventario"), '"confirmar inventario" NUNCA llegó al prompt');
    assert(!promptText.includes("entrega en 24"), '"entrega en 24 horas" NUNCA llegó al prompt');
    assert(!promptText.includes("garant"), "la garantía en Dropi NUNCA llegó al prompt");
    assert(!promptText.includes("proveedor-externo.cl"), "el link externo NUNCA llegó al prompt");
    assert(promptText.includes("secadora"), "el contenido legítimo (nombre del producto) SÍ llegó al prompt");

    const call = calls[0];
    assert(call.params.store === false, "la llamada a OpenAI usa store: false");
    assert(call.params.model === "gpt-5.6-terra", `usa el modelo fallback por defecto (obtuvo: "${call.params.model}")`);
  }

  // ── [1b] Regresión: aunque el MODELO falle y devuelva el encabezado genérico ─
  console.log('\n[1b] Si el modelo igual devuelve "Características destacadas" como nombre, el servidor lo corrige');
  {
    const input: AIProductStudioInput = {
      supplierText: "Secadora Portátil de Ropa\n- Seca rápido",
      selectedImages: [IMG(1)],
      tone: "directo",
    };
    const { client } = makeMockClient({
      name: "Características destacadas",
      category: "",
      tags: [],
      descriptionHtml: "<p>Producto práctico.</p>",
      productSections: [],
      galleryImageUrls: [IMG(1)],
      detectedFacts: [],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
    });
    const result = await withEnv({ AI_PRODUCT_STUDIO_ENABLED: "true", OPENAI_API_KEY: "sk-test-fake" }, () =>
      generateAIDraft(input, { client, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(result.ok, "generación exitosa");
    if (result.ok) {
      assert(result.draft.name === "Nombre por confirmar", `el servidor descarta el encabezado genérico (obtuvo: "${result.draft.name}")`);
      assert(result.draft.slug === "", "slug vacío cuando el nombre quedó en placeholder");
      assert(result.draft.fieldsNeedingConfirmation.includes("name"), "name queda en fieldsNeedingConfirmation");
    }
  }

  // ── [2] Red de seguridad anti-alucinación: specs SIN respaldo se eliminan ──
  console.log("\n[2] Specs técnicas mencionadas por el modelo pero AUSENTES del texto del proveedor se eliminan");
  {
    const input: AIProductStudioInput = {
      supplierText: "Organizador de Cocina Multiuso\n- Fácil de limpiar\n- Diseño apilable",
      selectedImages: [IMG(1)],
      tone: "directo",
    };
    const { client } = makeMockClient({
      name: "Organizador de Cocina Multiuso",
      category: "",
      tags: [],
      descriptionHtml:
        "<p>Un organizador práctico y apilable.</p><p>Cuenta con 600W de potencia, mide 29 x 22 x 10 cm, temporizador digital y enchufe universal.</p>",
      productSections: [
        {
          type: "benefits",
          data: {
            heading: "Beneficios",
            description: "",
            image_url: IMG(1),
            alt: "",
            items: [{ icon: "check", title: "Potente", description: "600W de potencia real" }],
          },
        },
      ],
      galleryImageUrls: [IMG(1)],
      detectedFacts: [{ claim: "Diseño apilable", source: "supplier_text" }],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
    });
    const result = await withEnv({ AI_PRODUCT_STUDIO_ENABLED: "true", OPENAI_API_KEY: "sk-test-fake" }, () =>
      generateAIDraft(input, { client, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(result.ok, "generación exitosa");
    if (result.ok) {
      const fullText = `${result.draft.descriptionHtml} ${JSON.stringify(result.draft.productSections)}`.toLowerCase();
      assert(!fullText.includes("600w") && !fullText.includes("600 w"), "potencia 600W removida (el modelo la inventó, no estaba en el texto)");
      assert(!fullText.includes("29 x 22 x 10 cm"), "medidas removidas (el modelo las inventó)");
      assert(!fullText.includes("temporizador"), "temporizador removido (el modelo lo inventó)");
      assert(!fullText.includes("enchufe universal"), "enchufe universal removido (el modelo lo inventó)");
      assert(fullText.includes("apilable"), "el contenido legítimo (diseño apilable) SÍ se conserva");

      assert(result.draft.claimsToAvoid.some((c) => c.includes("potencia")), "claimsToAvoid registra la potencia removida");
      assert(result.draft.claimsToAvoid.some((c) => c.includes("medidas")), "claimsToAvoid registra las medidas removidas");
      assert(result.draft.claimsToAvoid.some((c) => c.includes("temporizador")), "claimsToAvoid registra el temporizador removido");
      assert(result.draft.claimsToAvoid.some((c) => c.includes("enchufe universal")), "claimsToAvoid registra el enchufe universal removido");
    }
  }

  // ── [3] Ninguna URL de imagen generada puede ser distinta de las seleccionadas ─
  console.log("\n[3] URLs de imagen ajenas a las seleccionadas se descartan siempre");
  {
    const input: AIProductStudioInput = {
      supplierText: "Producto De Prueba\n- Punto uno",
      selectedImages: [IMG(1), IMG(2)],
      tone: "directo",
    };
    const { client } = makeMockClient({
      name: "Producto De Prueba",
      category: "",
      tags: [],
      descriptionHtml: "<p>Texto de prueba.</p>",
      productSections: [
        {
          type: "versatility",
          data: { heading: "Versatilidad", description: "", image_url: "https://evil.example.com/fake.jpg", alt: "" },
        },
      ],
      galleryImageUrls: [IMG(1), "https://evil.example.com/fake.jpg"],
      detectedFacts: [],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
    });
    const result = await withEnv({ AI_PRODUCT_STUDIO_ENABLED: "true", OPENAI_API_KEY: "sk-test-fake" }, () =>
      generateAIDraft(input, { client, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(result.ok, "generación exitosa");
    if (result.ok) {
      assert(
        result.draft.galleryImageUrls.length === 1 && result.draft.galleryImageUrls[0] === IMG(1),
        `galleryImageUrls solo conserva la imagen válida (obtuvo: ${JSON.stringify(result.draft.galleryImageUrls)})`
      );
      assert(
        !JSON.stringify(result.draft.galleryImageUrls).includes("evil.example.com"),
        "la URL ajena NUNCA aparece en galleryImageUrls"
      );
      const versatilitySection = result.draft.productSections.find((s) => s.type === "versatility");
      assert(
        versatilitySection?.type === "versatility" && versatilitySection.data.image_url === "",
        "la URL ajena en un bloque se vacía en vez de dejarse pasar"
      );
      assert(result.draft.meta.warnings.length > 0, "se registra una advertencia sobre la(s) imagen(es) descartada(s)");
    }

    // Caso extremo: TODAS las URLs propuestas son ajenas -> fallback a las seleccionadas.
    const { client: client2 } = makeMockClient({
      name: "Producto De Prueba",
      category: "",
      tags: [],
      descriptionHtml: "<p>Texto de prueba.</p>",
      productSections: [],
      galleryImageUrls: ["https://evil.example.com/a.jpg", "https://evil.example.com/b.jpg"],
      detectedFacts: [],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
    });
    const result2 = await withEnv({ AI_PRODUCT_STUDIO_ENABLED: "true", OPENAI_API_KEY: "sk-test-fake" }, () =>
      generateAIDraft(input, { client: client2, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(result2.ok, "generación exitosa (caso todas las URLs ajenas)");
    if (result2.ok) {
      assert(
        JSON.stringify(result2.draft.galleryImageUrls) === JSON.stringify([IMG(1), IMG(2)]),
        `si TODAS las URLs propuestas son ajenas, cae de vuelta a las seleccionadas por el admin (obtuvo: ${JSON.stringify(result2.draft.galleryImageUrls)})`
      );
    }
  }

  // ── [4] Slug siempre normalizado en servidor, nunca confía en el modelo ────
  console.log("\n[4] El slug siempre se deriva en servidor desde el nombre, incluso si el modelo intenta imponer otro");
  {
    const input: AIProductStudioInput = {
      supplierText: "Cojín Decorativo Redondo\n- Relleno suave",
      selectedImages: [IMG(1)],
      tone: "directo",
    };
    const { client } = makeMockClient({
      name: "Cojín Decorativo Redondo",
      slug: "hackeado-por-el-modelo", // el schema del modelo NO tiene "slug" — esto se descarta al parsear
      category: "",
      tags: [],
      descriptionHtml: "<p>Relleno suave.</p>",
      productSections: [],
      galleryImageUrls: [IMG(1)],
      detectedFacts: [],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
    });
    const result = await withEnv({ AI_PRODUCT_STUDIO_ENABLED: "true", OPENAI_API_KEY: "sk-test-fake" }, () =>
      generateAIDraft(input, { client, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(result.ok, "generación exitosa");
    if (result.ok) {
      assert(
        result.draft.slug === "cojin-decorativo-redondo",
        `slug = slugify(name), nunca lo que el modelo haya propuesto (obtuvo: "${result.draft.slug}")`
      );
    }
  }

  // ── [5] Nunca genera faq/testimonials/before_after (schema del modelo lo impide) ─
  console.log("\n[5] El schema exigido al modelo no permite faq/testimonials/before_after/media_strip/visual_sequence");
  {
    const input: AIProductStudioInput = {
      supplierText: "Producto De Prueba\n- Punto uno",
      selectedImages: [IMG(1)],
      tone: "directo",
    };
    const { client } = makeMockClient({
      name: "Producto De Prueba",
      category: "",
      tags: [],
      descriptionHtml: "<p>Texto.</p>",
      productSections: [{ type: "faq", data: { items: [{ question: "¿Sirve?", answer: "Sí" }] } }],
      galleryImageUrls: [IMG(1)],
      detectedFacts: [],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
    });
    const result = await withEnv({ AI_PRODUCT_STUDIO_ENABLED: "true", OPENAI_API_KEY: "sk-test-fake" }, () =>
      generateAIDraft(input, { client, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(!result.ok && result.code === "invalid_response", 'una respuesta con "faq" (fuera del schema permitido) se rechaza como invalid_response');
  }

  // ── [6] Respeta AI_PRODUCT_STUDIO_ENABLED y OPENAI_API_KEY ──────────────────
  console.log("\n[6] Errores claros cuando el estudio está deshabilitado o sin configurar");
  {
    const input: AIProductStudioInput = {
      supplierText: "Producto De Prueba\n- Punto uno",
      selectedImages: [IMG(1)],
      tone: "directo",
    };
    const { client } = makeMockClient({});

    const disabledResult = await withEnv({ AI_PRODUCT_STUDIO_ENABLED: "false" }, () => generateAIDraft(input, { client }));
    assert(!disabledResult.ok && disabledResult.code === "disabled", "AI_PRODUCT_STUDIO_ENABLED=false -> error claro, nunca llama a OpenAI");

    const notConfiguredResult = await withEnv({ AI_PRODUCT_STUDIO_ENABLED: "true", OPENAI_API_KEY: "" }, () =>
      generateAIDraft(input, { client })
    );
    assert(!notConfiguredResult.ok && notConfiguredResult.code === "not_configured", "sin OPENAI_API_KEY -> error claro, nunca llama a OpenAI");
  }

  // ── [7] Modelo configurable vía AI_PRODUCT_STUDIO_MODEL ─────────────────────
  console.log("\n[7] Usa AI_PRODUCT_STUDIO_MODEL cuando está definido, en vez del fallback");
  {
    const input: AIProductStudioInput = {
      supplierText: "Producto De Prueba\n- Punto uno",
      selectedImages: [IMG(1)],
      tone: "directo",
    };
    const { client, calls } = makeMockClient({
      name: "Producto De Prueba",
      category: "",
      tags: [],
      descriptionHtml: "<p>Texto.</p>",
      productSections: [],
      galleryImageUrls: [IMG(1)],
      detectedFacts: [],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
    });
    const result = await withEnv({ AI_PRODUCT_STUDIO_ENABLED: "true", OPENAI_API_KEY: "sk-test-fake", AI_PRODUCT_STUDIO_MODEL: "gpt-custom-test" }, () =>
      generateAIDraft(input, { client, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(result.ok && result.draft.meta.model === "gpt-custom-test", `usa el modelo de AI_PRODUCT_STUDIO_MODEL (obtuvo: "${result.ok ? result.draft.meta.model : "-"}")`);
    assert(calls[0]?.params.model === "gpt-custom-test", "el modelo enviado a OpenAI respeta AI_PRODUCT_STUDIO_MODEL");
  }

  // ── [8] Neon no cambia durante toda la generación (nunca toca la base) ──────
  console.log("\n[8] Precio/stock/productos/pedidos en Neon no cambian durante la generación");
  if (process.env.DATABASE_URL) {
    const sql = neon(process.env.DATABASE_URL);
    const productsAfter = Number((await sql`select count(*) from products`)[0].count);
    const ordersAfter = Number((await sql`select count(*) from orders`)[0].count);
    assert(productsAfter === productsBefore, `productos sin cambios (antes: ${productsBefore}, después: ${productsAfter})`);
    assert(ordersAfter === ordersBefore, `pedidos sin cambios (antes: ${ordersBefore}, después: ${ordersAfter})`);
  } else {
    console.log("  (omitido: sin DATABASE_URL configurado)");
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
  console.error("\n[verify-ai-product-studio-openai] Error:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
