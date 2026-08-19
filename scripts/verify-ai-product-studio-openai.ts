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
  return content
    .filter((c) => c.type === "input_text")
    .map((c) => c.text ?? "")
    .join("\n")
    .toLowerCase();
}

/** Lista de URLs de imagen que efectivamente se enviaron a OpenAI (input_image), para probar que nunca varían de las seleccionadas. */
function imageUrlsSentToModel(calls: CapturedCall[]): string[] {
  const params = calls[0]?.params as { input?: Array<{ content?: Array<{ type: string; image_url?: string }> }> };
  const content = params?.input?.[0]?.content ?? [];
  return content.filter((c) => c.type === "input_image").map((c) => c.image_url ?? "");
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

  const SECADORA_SUPPLIER_TEXT = [
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

  // ── [1] Secadora portátil: nombre real, IDs de imagen, specs anclados, sin ruido ─
  console.log('[1] Secadora portátil: nombre real (nunca "Características destacadas"), IDs de imagen, specs anclados se conservan');
  {
    const input: AIProductStudioInput = {
      supplierText: SECADORA_SUPPLIER_TEXT,
      selectedImages: [IMG(1), IMG(2)],
      tone: "directo",
    };

    const { client, calls } = makeMockClient({
      name: "Secadora Portátil de Ropa",
      category: "",
      tags: [],
      descriptionHtml:
        "<p>Seca tu ropa rápido, ideal para espacios pequeños.</p><p>Potencia 600W, con temporizador y enchufe universal.</p>",
      productSections: [
        {
          type: "benefits",
          data: {
            heading: "Beneficios",
            description: "",
            imageId: "image_1",
            alt: "",
            items: [
              { icon: "clock", title: "Rápida", description: "Seca en minutos" },
              { icon: "package", title: "Compacta", description: "Ideal para espacios pequeños" },
            ],
          },
        },
        {
          type: "measurements",
          data: {
            heading: "Medidas",
            description: "Mide 29 x 22 x 10 cm.",
            imageId: "image_2",
            alt: "",
          },
        },
      ],
      galleryImageIds: ["image_1", "image_2"],
      detectedFacts: [
        { claim: "Potencia 600W", source: "supplier_text" },
        { claim: "Medidas 29 x 22 x 10 cm", source: "supplier_text" },
      ],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
      imageMeasurements: [],
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

      const measurementsSection = result.draft.productSections.find((s) => s.type === "measurements");
      assert(Boolean(measurementsSection), 'se generó un bloque "measurements" (Medidas)');
      assert(
        measurementsSection?.type === "measurements" && measurementsSection.data.image_url === IMG(2),
        `el bloque Medidas resuelve imageId "image_2" a la URL real correspondiente (obtuvo: "${measurementsSection?.type === "measurements" ? measurementsSection.data.image_url : "-"}")`
      );

      const benefitsSection = result.draft.productSections.find((s) => s.type === "benefits");
      assert(
        benefitsSection?.type === "benefits" && benefitsSection.data.image_url === IMG(1),
        "el bloque Beneficios resuelve imageId 'image_1' a la URL real correspondiente"
      );

      assert(
        JSON.stringify(result.draft.galleryImageUrls) === JSON.stringify([IMG(1), IMG(2)]),
        `galleryImageIds ["image_1","image_2"] se resuelve a las URLs reales en el mismo orden (obtuvo: ${JSON.stringify(result.draft.galleryImageUrls)})`
      );
      assert(
        !result.draft.meta.warnings.includes("Se conservó tu selección de galería."),
        "no aparece el aviso de fallback (el modelo SÍ propuso IDs válidos)"
      );

      const fullText = `${result.draft.descriptionHtml} ${JSON.stringify(result.draft.productSections)}`.toLowerCase();
      assert(fullText.includes("600w") || fullText.includes("600 w"), "potencia 600W SE CONSERVA (estaba en el texto del proveedor)");
      assert(fullText.includes("29 x 22 x 10 cm"), "medidas 29x22x10cm SE CONSERVAN (estaban en el texto)");
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
    assert(promptText.includes("image_1") && promptText.includes("image_2"), "el prompt anuncia los IDs de imagen exactos (image_1, image_2)");
    assert(promptText.includes("solo con estos ids exactos"), "el prompt indica explícitamente responder solo con los IDs exactos");

    assert(
      JSON.stringify(imageUrlsSentToModel(calls)) === JSON.stringify([IMG(1), IMG(2)]),
      "las URLs reales solo viajan en el contenido de imagen (input_image), nunca como texto plano"
    );

    const call = calls[0];
    assert(call.params.store === false, "la llamada a OpenAI usa store: false");
    assert(call.params.model === "gpt-5.6-terra", `usa el modelo fallback por defecto (obtuvo: "${call.params.model}")`);
  }

  // ── [1b] Auto-inyección: el modelo NO genera "measurements" pero el texto trae medidas ─
  console.log('\n[1b] Si el modelo omite el bloque "Medidas" pero el texto trae dimensiones explícitas, el servidor lo agrega');
  {
    const input: AIProductStudioInput = {
      supplierText: SECADORA_SUPPLIER_TEXT,
      selectedImages: [IMG(1), IMG(2)],
      tone: "directo",
    };
    const { client } = makeMockClient({
      name: "Secadora Portátil de Ropa",
      category: "",
      tags: [],
      descriptionHtml: "<p>Seca tu ropa rápido, ideal para espacios pequeños.</p><p>Con temporizador y enchufe universal.</p>",
      productSections: [
        {
          type: "usage",
          data: { heading: "Uso", description: "Ideal para departamentos pequeños.", imageId: "image_1", alt: "" },
        },
      ],
      galleryImageIds: ["image_1", "image_2"],
      detectedFacts: [],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
      imageMeasurements: [],
    });
    const result = await withEnv({ AI_PRODUCT_STUDIO_ENABLED: "true", OPENAI_API_KEY: "sk-test-fake" }, () =>
      generateAIDraft(input, { client, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(result.ok, "generación exitosa");
    if (result.ok) {
      const measurementsSection = result.draft.productSections.find((s) => s.type === "measurements");
      assert(Boolean(measurementsSection), 'el servidor agrega un bloque "measurements" aunque el modelo no lo haya propuesto');
      assert(
        measurementsSection?.type === "measurements" && measurementsSection.data.description?.includes("29 x 22 x 10 cm"),
        `el bloque agregado contiene las dimensiones reales del texto (obtuvo: "${measurementsSection?.type === "measurements" ? measurementsSection.data.description : "-"}")`
      );
      assert(
        result.draft.meta.warnings.some((w) => w.toLowerCase().includes("medidas")),
        "se avisa en warnings que el bloque Medidas se agregó automáticamente"
      );
      const usageSection = result.draft.productSections.find((s) => s.type === "usage");
      assert(Boolean(usageSection), 'el bloque "usage" que sí propuso el modelo se conserva');
    }

    // Sin dimensiones explícitas en el texto -> NO se agrega ningún bloque de medidas inventado.
    const inputSinMedidas: AIProductStudioInput = {
      supplierText: "Organizador de Cocina Multiuso\n- Fácil de limpiar\n- Diseño apilable",
      selectedImages: [IMG(1)],
      tone: "directo",
    };
    const { client: client2 } = makeMockClient({
      name: "Organizador de Cocina Multiuso",
      category: "",
      tags: [],
      descriptionHtml: "<p>Un organizador práctico.</p>",
      productSections: [],
      galleryImageIds: ["image_1"],
      detectedFacts: [],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
      imageMeasurements: [],
    });
    const resultSinMedidas = await withEnv({ AI_PRODUCT_STUDIO_ENABLED: "true", OPENAI_API_KEY: "sk-test-fake" }, () =>
      generateAIDraft(inputSinMedidas, { client: client2, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(resultSinMedidas.ok, "generación exitosa (sin medidas en el texto)");
    if (resultSinMedidas.ok) {
      assert(
        !resultSinMedidas.draft.productSections.some((s) => s.type === "measurements"),
        "sin dimensiones explícitas en el texto -> NO se inventa un bloque Medidas"
      );
    }
  }

  // ── [1c] Regresión: aunque el MODELO falle y devuelva el encabezado genérico ─
  console.log('\n[1c] Si el modelo igual devuelve "Características destacadas" como nombre, el servidor lo corrige');
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
      galleryImageIds: ["image_1"],
      detectedFacts: [],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
      imageMeasurements: [],
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
        "<p>Un organizador práctico y apilable.</p><p>Cuenta con 600W de potencia, mide 29 x 22 x 10 cm, temporizador digital, enchufe universal, capacidad de carga de 20kg, filtro UV, seguridad eléctrica certificada y seca en 5 minutos, con despacho express garantizado.</p>",
      productSections: [
        {
          type: "benefits",
          data: {
            heading: "Beneficios",
            description: "",
            imageId: "image_1",
            alt: "",
            items: [{ icon: "check", title: "Potente", description: "600W de potencia real" }],
          },
        },
      ],
      galleryImageIds: ["image_1"],
      detectedFacts: [{ claim: "Diseño apilable", source: "supplier_text" }],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
      imageMeasurements: [],
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
      assert(!fullText.includes("capacidad de carga"), "capacidad de carga removida (el modelo la inventó)");
      assert(!fullText.includes(" uv"), "mención de UV removida (el modelo la inventó)");
      assert(!fullText.includes("seguridad eléctrica"), "seguridad eléctrica removida (el modelo la inventó)");
      assert(!fullText.includes("minutos"), "tiempo de secado en minutos removido (el modelo lo inventó)");
      assert(!fullText.includes("despacho express") && !fullText.includes("garantizado"), "promesa de despacho removida (el modelo la inventó)");
      assert(fullText.includes("apilable"), "el contenido legítimo (diseño apilable) SÍ se conserva");
      // Sin dimensiones reales en el texto de origen, tampoco se auto-inyecta un bloque Medidas.
      assert(!result.draft.productSections.some((s) => s.type === "measurements"), "no se agrega un bloque Medidas sin dimensiones reales en el texto");

      assert(result.draft.claimsToAvoid.some((c) => c.includes("potencia")), "claimsToAvoid registra la potencia removida");
      assert(result.draft.claimsToAvoid.some((c) => c.includes("medidas")), "claimsToAvoid registra las medidas removidas");
      assert(result.draft.claimsToAvoid.some((c) => c.includes("temporizador")), "claimsToAvoid registra el temporizador removido");
      assert(result.draft.claimsToAvoid.some((c) => c.includes("enchufe universal")), "claimsToAvoid registra el enchufe universal removido");
    }
  }

  // ── [3] IDs de imagen: solo se resuelven a URLs realmente seleccionadas ────
  console.log("\n[3] Cada ID de imagen (galería y bloques) se resuelve solamente a una URL seleccionada por el admin");
  {
    const input: AIProductStudioInput = {
      supplierText: "Producto De Prueba\n- Punto uno",
      selectedImages: [IMG(1), IMG(2)],
      tone: "directo",
    };

    // 3a) ID desconocido ("image_99") en un bloque -> se descarta (imageId null, no una URL rota).
    const { client } = makeMockClient({
      name: "Producto De Prueba",
      category: "",
      tags: [],
      descriptionHtml: "<p>Texto de prueba.</p>",
      productSections: [
        { type: "versatility", data: { heading: "Versatilidad", description: "", imageId: "image_99", alt: "" } },
      ],
      galleryImageIds: ["image_1", "image_99"],
      detectedFacts: [],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
      imageMeasurements: [],
    });
    const result = await withEnv({ AI_PRODUCT_STUDIO_ENABLED: "true", OPENAI_API_KEY: "sk-test-fake" }, () =>
      generateAIDraft(input, { client, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(result.ok, "generación exitosa (ID desconocido)");
    if (result.ok) {
      assert(
        JSON.stringify(result.draft.galleryImageUrls) === JSON.stringify([IMG(1)]),
        `un ID desconocido en galleryImageIds se descarta, se conserva solo el válido (obtuvo: ${JSON.stringify(result.draft.galleryImageUrls)})`
      );
      const versatilitySection = result.draft.productSections.find((s) => s.type === "versatility");
      assert(
        versatilitySection?.type === "versatility" && versatilitySection.data.image_url === "",
        "un ID desconocido en un bloque nunca se resuelve a una URL: queda vacío"
      );
      assert(result.draft.meta.warnings.length > 0, "se registra una advertencia sobre el/los ID(s) inválido(s)");
    }

    // 3b) El modelo intenta colar una URL directa en vez de un ID -> tratada como ID desconocido, rechazada.
    const { client: client2 } = makeMockClient({
      name: "Producto De Prueba",
      category: "",
      tags: [],
      descriptionHtml: "<p>Texto de prueba.</p>",
      productSections: [
        { type: "versatility", data: { heading: "Versatilidad", description: "", imageId: "https://evil.example.com/fake.jpg", alt: "" } },
      ],
      galleryImageIds: ["https://evil.example.com/fake.jpg", "image_1"],
      detectedFacts: [],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
      imageMeasurements: [],
    });
    const result2 = await withEnv({ AI_PRODUCT_STUDIO_ENABLED: "true", OPENAI_API_KEY: "sk-test-fake" }, () =>
      generateAIDraft(input, { client: client2, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(result2.ok, "generación exitosa (URL directa en vez de ID)");
    if (result2.ok) {
      assert(
        !JSON.stringify(result2.draft.galleryImageUrls).includes("evil.example.com"),
        "una URL directa propuesta como 'ID' NUNCA se cuela en galleryImageUrls"
      );
      assert(
        JSON.stringify(result2.draft.galleryImageUrls) === JSON.stringify([IMG(1)]),
        `solo queda la imagen resuelta por su ID real válido (obtuvo: ${JSON.stringify(result2.draft.galleryImageUrls)})`
      );
      const versatilitySection = result2.draft.productSections.find((s) => s.type === "versatility");
      assert(
        versatilitySection?.type === "versatility" && versatilitySection.data.image_url === "",
        "una URL directa como imageId de un bloque nunca se resuelve: queda vacío, no la URL inventada"
      );
    }

    // 3c) Ninguno de los IDs propuestos es válido -> fallback completo a la selección del admin, con aviso.
    const { client: client3 } = makeMockClient({
      name: "Producto De Prueba",
      category: "",
      tags: [],
      descriptionHtml: "<p>Texto de prueba.</p>",
      productSections: [],
      galleryImageIds: ["image_99", "image_100"],
      detectedFacts: [],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
      imageMeasurements: [],
    });
    const result3 = await withEnv({ AI_PRODUCT_STUDIO_ENABLED: "true", OPENAI_API_KEY: "sk-test-fake" }, () =>
      generateAIDraft(input, { client: client3, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(result3.ok, "generación exitosa (todos los IDs inválidos)");
    if (result3.ok) {
      assert(
        JSON.stringify(result3.draft.galleryImageUrls) === JSON.stringify([IMG(1), IMG(2)]),
        `si NINGÚN ID propuesto es válido, cae de vuelta a la selección completa del admin en su orden (obtuvo: ${JSON.stringify(result3.draft.galleryImageUrls)})`
      );
      assert(
        result3.draft.meta.warnings.includes("Se conservó tu selección de galería."),
        'se muestra el aviso exacto "Se conservó tu selección de galería."'
      );
    }
  }

  // ── [3d] Si el modelo omite galleryImageIds -> se conserva la selección del admin ─
  console.log("\n[3d] Si el modelo omite galleryImageIds (array vacío), se conserva la galería elegida por el admin, con aviso");
  {
    const input: AIProductStudioInput = {
      supplierText: "Producto De Prueba\n- Punto uno",
      selectedImages: [IMG(1), IMG(2), IMG(3)],
      tone: "directo",
    };
    const { client } = makeMockClient({
      name: "Producto De Prueba",
      category: "",
      tags: [],
      descriptionHtml: "<p>Texto de prueba.</p>",
      productSections: [],
      galleryImageIds: [],
      detectedFacts: [],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
      imageMeasurements: [],
    });
    const result = await withEnv({ AI_PRODUCT_STUDIO_ENABLED: "true", OPENAI_API_KEY: "sk-test-fake" }, () =>
      generateAIDraft(input, { client, generatedAt: "2026-01-01T00:00:00.000Z" })
    );
    assert(result.ok, "generación exitosa");
    if (result.ok) {
      assert(
        JSON.stringify(result.draft.galleryImageUrls) === JSON.stringify([IMG(1), IMG(2), IMG(3)]),
        `galleryImageIds vacío -> se conserva la selección completa del admin en orden (obtuvo: ${JSON.stringify(result.draft.galleryImageUrls)})`
      );
      assert(
        result.draft.meta.warnings.includes("Se conservó tu selección de galería."),
        'se muestra el aviso exacto "Se conservó tu selección de galería."'
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
      galleryImageIds: ["image_1"],
      detectedFacts: [],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
      imageMeasurements: [],
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
      galleryImageIds: ["image_1"],
      detectedFacts: [],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
      imageMeasurements: [],
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
      galleryImageIds: ["image_1"],
      detectedFacts: [],
      claimsToAvoid: [],
      fieldsNeedingConfirmation: [],
      imageMeasurements: [],
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
