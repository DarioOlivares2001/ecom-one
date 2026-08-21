/**
 * Prueba pura del puente entre el asistente IA (`/admin/productos/crear-con-ia`)
 * y el formulario manual (`/admin/productos/nuevo`) — `lib/ai-product-studio/bridge.ts`.
 *
 * Este es el mecanismo exacto que corrige el bug reportado: el botón final
 * del asistente ("Continuar a revisión", antes "Aplicar al borrador") NUNCA
 * crea un producto — solo escribe acá antes de navegar. Esta prueba confirma:
 *  1. TODOS los campos generados sobreviven la transferencia completos
 *     (nombre, slug, descripción, galería, biblioteca, secciones, precio,
 *     precio comparativo, costo, stock y enlace Dropi).
 *  2. "No venía nada del asistente" (`absent`) y "venía algo pero no se pudo
 *     leer" (`invalid`) son estados DISTINGUIBLES — antes ambos devolvían
 *     `null` y el formulario quedaba en blanco sin explicar por qué.
 *  3. Si escribir el puente falla, `writeAIStudioBridge` lo reporta (`false`)
 *     en vez de fallar en silencio.
 *
 * 100% en memoria — nunca toca un navegador real, Neon, R2 ni crea ningún
 * producto. `bridge.ts` no es "server-only" (lo usa un componente cliente),
 * así que corre con `tsx` normal, sin `--conditions=react-server`.
 *
 * Uso: npx tsx scripts/verify-ai-studio-review-handoff.ts
 */

// ── Mock mínimo de sessionStorage (Node no lo trae) ─────────────────────────
class MemoryStorage {
  private store = new Map<string, string>();
  private failNextSetItem = false;

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    if (this.failNextSetItem) {
      this.failNextSetItem = false;
      throw new DOMException("QuotaExceededError (simulado)", "QuotaExceededError");
    }
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  /** Solo para la prueba: fuerza que el próximo `setItem` falle (simula sessionStorage lleno/deshabilitado). */
  simulateNextWriteFailure(): void {
    this.failNextSetItem = true;
  }
  /** Solo para la prueba: corrompe el valor guardado bajo cualquier key existente, sin asumir el nombre exacto de la key interna. */
  corruptStoredValue(newValue: string): void {
    const key = Array.from(this.store.keys())[0];
    if (key) this.store.set(key, newValue);
  }
  get size(): number {
    return this.store.size;
  }
}

const mockStorage = new MemoryStorage();
(globalThis as unknown as { sessionStorage: MemoryStorage }).sessionStorage = mockStorage;

// Import DESPUÉS de instalar el mock — bridge.ts referencia `sessionStorage` global al llamarse, no al importarse, pero se mantiene el orden por claridad.
import {
  writeAIStudioBridge,
  readAndClearAIStudioBridge,
  type AIStudioBridgePayload,
} from "../lib/ai-product-studio/bridge";
import type { AIProductDraft } from "../lib/ai-product-studio/schema";
import type { CommercialData } from "../lib/ai-product-studio/commercialData";

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

function fullDraft(): AIProductDraft {
  return {
    name: "Molino Eléctrico para Café y Granos",
    slug: "molino-electrico-para-cafe-y-granos",
    category: "Cocina",
    tags: ["cocina", "café"],
    descriptionHtml: "<p>Muele café y granos de forma pareja, en segundos.</p>",
    productSections: [
      {
        id: "sec-benefits-1",
        type: "benefits",
        enabled: true,
        order: 0,
        data: {
          heading: "Beneficios",
          image_url: IMG(1),
          items: [{ icon: "check", title: "Fácil de limpiar", description: "Piezas desmontables" }],
        },
      },
      {
        id: "sec-measurements-1",
        type: "measurements",
        enabled: true,
        order: 1,
        data: {
          heading: "Medidas referenciales",
          description: "Las medidas indicadas en la imagen del proveedor son: 17 cm, 10,5 cm, 5 cm.",
          image_url: IMG(2),
          alt: undefined,
        },
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

function fullCommercial(): CommercialData {
  return {
    price: 49990,
    compareAtPrice: 79990,
    stock: 12,
    costPrice: 25000,
    dropiProductUrl: "https://app.dropi.cl/producto/molino-123",
  };
}

function fullPayload(): AIStudioBridgePayload {
  return {
    draft: fullDraft(),
    productMedia: [IMG(1), IMG(2), IMG(3)],
    commercial: fullCommercial(),
    aiGeneratedImageUrls: [IMG(3)],
  };
}

async function main() {
  // ── [1] Sin nada escrito -> "absent", nunca "invalid" ───────────────────────
  console.log('[1] Nada escrito en el puente -> status "absent" (caso normal al entrar directo a /nuevo)');
  {
    mockStorage.clear();
    const result = readAndClearAIStudioBridge();
    assert(result.status === "absent", `status "absent" cuando no hay nada (obtuvo: "${result.status}")`);
  }

  // ── [2] Transferencia completa: TODOS los campos sobreviven ─────────────────
  console.log("\n[2] Transferencia completa: nombre, slug, descripción, galería, biblioteca, secciones y datos comerciales sobreviven intactos");
  {
    mockStorage.clear();
    const payload = fullPayload();
    const wrote = writeAIStudioBridge(payload);
    assert(wrote === true, "writeAIStudioBridge devuelve true cuando sessionStorage funciona");

    const result = readAndClearAIStudioBridge();
    assert(result.status === "ok", `status "ok" tras una escritura válida (obtuvo: "${result.status}")`);
    if (result.status === "ok") {
      const { payload: read } = result;
      assert(read.draft.name === payload.draft.name, "nombre sobrevive la transferencia");
      assert(read.draft.slug === payload.draft.slug, "slug sobrevive la transferencia");
      assert(read.draft.descriptionHtml === payload.draft.descriptionHtml, "descripción sobrevive la transferencia");
      assert(
        JSON.stringify(read.draft.galleryImageUrls) === JSON.stringify(payload.draft.galleryImageUrls),
        "galería (galleryImageUrls) sobrevive la transferencia, en el mismo orden"
      );
      assert(
        JSON.stringify(read.productMedia) === JSON.stringify(payload.productMedia),
        "biblioteca completa (productMedia) sobrevive la transferencia"
      );
      assert(
        read.draft.productSections.length === payload.draft.productSections.length,
        `las ${payload.draft.productSections.length} secciones sobreviven la transferencia (obtuvo ${read.draft.productSections.length})`
      );
      assert(
        read.draft.productSections.some((s) => s.type === "measurements"),
        "la sección de Medidas específicamente sobrevive (no se pierde ni se genera de nuevo)"
      );

      assert(Boolean(read.commercial), "los datos comerciales llegan (no quedan undefined)");
      assert(read.commercial?.price === 49990, `precio de venta sobrevive (obtuvo: ${read.commercial?.price})`);
      assert(read.commercial?.compareAtPrice === 79990, `precio comparativo sobrevive (obtuvo: ${read.commercial?.compareAtPrice})`);
      assert(read.commercial?.costPrice === 25000, `precio costo sobrevive (obtuvo: ${read.commercial?.costPrice})`);
      assert(read.commercial?.stock === 12, `stock sobrevive (obtuvo: ${read.commercial?.stock})`);
      assert(
        read.commercial?.dropiProductUrl === "https://app.dropi.cl/producto/molino-123",
        `enlace Dropi sobrevive (obtuvo: "${read.commercial?.dropiProductUrl}")`
      );

      assert(
        JSON.stringify(read.aiGeneratedImageUrls) === JSON.stringify(payload.aiGeneratedImageUrls),
        "las URLs de imágenes IA (para la insignia 'Generada con IA') sobreviven"
      );
    }
  }

  // ── [3] El puente se limpia tras leerlo (nunca se reaplica dos veces) ───────
  console.log("\n[3] Tras leer el puente una vez, queda vacío — una segunda lectura da 'absent'");
  {
    mockStorage.clear();
    writeAIStudioBridge(fullPayload());
    readAndClearAIStudioBridge();
    const second = readAndClearAIStudioBridge();
    assert(second.status === "absent", "una segunda lectura no repite el mismo borrador");
  }

  // ── [4] "invalid": venía algo pero el JSON está corrupto ────────────────────
  console.log('\n[4] JSON corrupto en el puente -> status "invalid" (nunca "absent", nunca revienta)');
  {
    mockStorage.clear();
    writeAIStudioBridge(fullPayload());
    mockStorage.corruptStoredValue("{ esto no es JSON válido ");
    const result = readAndClearAIStudioBridge();
    assert(result.status === "invalid", `status "invalid" con JSON corrupto (obtuvo: "${result.status}")`);
    assert(mockStorage.size === 0, "el puente corrupto igual se limpia (no queda atascado para siempre)");
  }

  // ── [5] "invalid": JSON válido pero el borrador no calza con el schema ──────
  console.log('\n[5] Borrador con forma inválida (de una versión anterior) -> status "invalid", nunca se aplica a medias');
  {
    mockStorage.clear();
    writeAIStudioBridge(fullPayload());
    mockStorage.corruptStoredValue(JSON.stringify({ draft: { name: "Solo esto, sin el resto de los campos" } }));
    const result = readAndClearAIStudioBridge();
    assert(result.status === "invalid", `status "invalid" cuando el draft no valida contra el schema (obtuvo: "${result.status}")`);
  }

  // ── [6] Falla al escribir -> writeAIStudioBridge avisa, nunca falla en silencio ──
  console.log("\n[6] Si sessionStorage.setItem falla (ej. cuota excedida), writeAIStudioBridge devuelve false");
  {
    mockStorage.clear();
    mockStorage.simulateNextWriteFailure();
    const wrote = writeAIStudioBridge(fullPayload());
    assert(wrote === false, "writeAIStudioBridge devuelve false en vez de lanzar o fallar en silencio");
    const result = readAndClearAIStudioBridge();
    assert(result.status === "absent", "como la escritura falló, no queda nada a medio escribir en el puente");
  }

  if (failures > 0) {
    console.error(`\n${failures} aserción(es) fallaron.`);
    process.exitCode = 1;
  } else {
    console.log(
      "\nTodas las aserciones pasaron. Prueba 100% en memoria: nunca se abrió un navegador, nunca se tocó Neon/R2, " +
        "y nunca se creó ningún producto (ese paso solo ocurre en createProductAction, al presionar 'Guardar' de verdad)."
    );
    process.exitCode = 0;
  }
}

main().catch((error) => {
  console.error("\n[verify-ai-studio-review-handoff] Error:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
