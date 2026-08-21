/**
 * Nivel 3 del Estudio IA de Producto, pasos 2 y 3: generación real de UNA
 * imagen por edición sobre una foto de referencia (`generateProductImage.ts`)
 * y las utilidades puras de metadata usadas al subir una imagen ya aprobada
 * (`uploadApprovedImage.ts`). Cliente de OpenAI 100% mock — nunca llama a la
 * red real de OpenAI, y nunca se llama `uploadApprovedAIImage` de verdad (esa
 * función sí toca R2 real; se prueban solo sus helpers puros, mismo criterio
 * ya usado en este repo de no mockear el cliente S3/R2 — ver nota al final).
 *
 * Uso: npx tsx --conditions=react-server scripts/verify-ai-studio-image-generation.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { APIConnectionTimeoutError, APIError } from "openai";
import {
  generateProductImage,
  type AIImageGenerationClient,
} from "../lib/ai-product-studio/visualEnhancement/generateProductImage";
import {
  extensionForMimeType,
  toAsciiMetadataValue,
} from "../lib/ai-product-studio/visualEnhancement/uploadApprovedImage";

let failures = 0;
function assert(condition: unknown, message: string): void {
  if (condition) {
    console.log(`  OK: ${message}`);
  } else {
    failures += 1;
    console.error(`  FALLO: ${message}`);
  }
}

const REFERENCE_URL = "https://pub-test.r2.dev/products/test-1.webp";
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

/** Simula la descarga de la foto de referencia (`fetch(referenceImageUrl)`) sin tocar la red real. */
function withMockedFetch<T>(
  response: { ok: boolean; status?: number; contentType?: string; bytes?: number } | "throw",
  fn: () => Promise<T>
): Promise<T> {
  const originalFetch = global.fetch;
  global.fetch = (async () => {
    if (response === "throw") throw new Error("network down");
    if (!response.ok) return { ok: false, status: response.status ?? 500 } as Response;
    return {
      ok: true,
      headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? (response.contentType ?? "image/webp") : null) },
      arrayBuffer: async () => new ArrayBuffer(response.bytes ?? 1024),
    } as unknown as Response;
  }) as typeof fetch;
  return fn().finally(() => {
    global.fetch = originalFetch;
  });
}

type MockImagesOutcome = { b64: string } | { throwStatus: number } | { throwTimeout: true };

function makeMockImagesClient(
  outcome: MockImagesOutcome
): { client: AIImageGenerationClient; calls: Record<string, unknown>[] } {
  const calls: Record<string, unknown>[] = [];
  const client: AIImageGenerationClient = {
    images: {
      async edit(params) {
        calls.push(params);
        if ("throwTimeout" in outcome) {
          const err = Object.assign(new Error("timed out"), {});
          Object.setPrototypeOf(err, APIConnectionTimeoutError.prototype);
          throw err;
        }
        if ("throwStatus" in outcome) {
          const err = Object.assign(new Error("api error"), { status: outcome.throwStatus });
          Object.setPrototypeOf(err, APIError.prototype);
          throw err;
        }
        return { data: [{ b64_json: outcome.b64 }] };
      },
    },
  };
  return { client, calls };
}

async function main() {
  // ── [1] Generación exitosa: nunca sube nada a R2, solo devuelve el base64 ──
  console.log("[1] Generación exitosa: devuelve el base64 recibido de OpenAI, sin subir nada a R2");
  {
    const { client, calls } = makeMockImagesClient({ b64: "ZmFrZS1pbWFnZS1ieXRlcw==" });
    const result = await withEnv(BASE_ENV, () =>
      withMockedFetch({ ok: true, contentType: "image/webp" }, () =>
        generateProductImage({ prompt: "Foto en una cocina pequeña, con luz natural", referenceImageUrl: REFERENCE_URL }, { client })
      )
    );
    assert(result.ok, `generación exitosa (obtuvo: ${result.ok ? "ok" : result.error})`);
    if (result.ok) {
      assert(result.base64 === "ZmFrZS1pbWFnZS1ieXRlcw==", "devuelve exactamente el base64 que entregó OpenAI");
      assert(result.mimeType === "image/png", "el mimeType de salida es image/png (formato de gpt-image-1)");
    }
    assert(calls.length === 1, "se llamó a images.edit exactamente una vez");
    const sentPrompt = String(calls[0]?.prompt ?? "");
    assert(sentPrompt.includes("Foto en una cocina pequeña"), "el prompt del admin SÍ llega al modelo");
    assert(
      sentPrompt.toLowerCase().includes("manteniendo exactamente el producto real"),
      "el prompt final SIEMPRE incluye el prefijo de fidelidad — el admin no puede omitirlo ni sobreescribirlo"
    );
    assert(
      sentPrompt.toLowerCase().includes("misma forma, proporciones"),
      "el prefijo de seguridad exige conservar forma/proporciones del producto real"
    );
    assert(calls[0]?.input_fidelity === "high", "se pide input_fidelity: 'high' para maximizar fidelidad al producto real");
    assert(calls[0]?.image !== undefined, "se envía la imagen de referencia real a OpenAI (no solo texto)");
  }

  // ── [2] Cuota excedida (429) -> código claro, nunca un error genérico ──────
  console.log("\n[2] Error 429 de OpenAI -> code: 'quota_exceeded', mensaje claro");
  {
    const { client } = makeMockImagesClient({ throwStatus: 429 });
    const result = await withEnv(BASE_ENV, () =>
      withMockedFetch({ ok: true }, () => generateProductImage({ prompt: "prompt de prueba", referenceImageUrl: REFERENCE_URL }, { client }))
    );
    assert(!result.ok && result.code === "quota_exceeded", `cuota excedida detectada correctamente (obtuvo: ${!result.ok ? result.code : "ok"})`);
  }

  // ── [3] Otro error de API -> code genérico, nunca filtra detalles internos ─
  console.log("\n[3] Otro error de la API de OpenAI (500) -> code: 'api_error'");
  {
    const { client } = makeMockImagesClient({ throwStatus: 500 });
    const result = await withEnv(BASE_ENV, () =>
      withMockedFetch({ ok: true }, () => generateProductImage({ prompt: "prompt de prueba", referenceImageUrl: REFERENCE_URL }, { client }))
    );
    assert(!result.ok && result.code === "api_error", "error 500 -> code: 'api_error'");
  }

  // ── [3b] Timeout de conexión -> code: 'timeout' ─────────────────────────────
  console.log("\n[3b] Timeout de conexión con OpenAI -> code: 'timeout'");
  {
    const { client } = makeMockImagesClient({ throwTimeout: true });
    const result = await withEnv(BASE_ENV, () =>
      withMockedFetch({ ok: true }, () => generateProductImage({ prompt: "prompt de prueba", referenceImageUrl: REFERENCE_URL }, { client }))
    );
    assert(!result.ok && result.code === "timeout", `timeout detectado correctamente (obtuvo: ${!result.ok ? result.code : "ok"})`);
  }

  // ── [4] Falla al descargar la foto de referencia -> nunca llega a llamar a OpenAI ──
  console.log("\n[4] Si no se puede descargar la foto de referencia, nunca se llama a OpenAI");
  {
    const { client, calls } = makeMockImagesClient({ b64: "xx" });
    const result = await withEnv(BASE_ENV, () =>
      withMockedFetch({ ok: false, status: 404 }, () =>
        generateProductImage({ prompt: "prompt de prueba", referenceImageUrl: REFERENCE_URL }, { client })
      )
    );
    assert(!result.ok && result.code === "reference_fetch_failed", "código claro cuando la foto de referencia no se puede leer");
    assert(calls.length === 0, "nunca se llamó a OpenAI si la referencia no se pudo descargar (no se gasta cuota)");
  }

  // ── [5] Prompt vacío se rechaza antes de tocar la red ──────────────────────
  console.log("\n[5] Prompt vacío se rechaza sin llamar a nadie");
  {
    const { client, calls } = makeMockImagesClient({ b64: "xx" });
    const result = await withEnv(BASE_ENV, () =>
      withMockedFetch({ ok: true }, () => generateProductImage({ prompt: "   ", referenceImageUrl: REFERENCE_URL }, { client }))
    );
    assert(!result.ok && result.code === "invalid_prompt", "prompt vacío -> invalid_prompt");
    assert(calls.length === 0, "no se descarga la referencia ni se llama a OpenAI con un prompt vacío");
  }

  // ── [6] Respeta AI_PRODUCT_STUDIO_ENABLED / OPENAI_API_KEY ──────────────────
  console.log("\n[6] Errores claros cuando el estudio está deshabilitado o sin configurar");
  {
    const { client } = makeMockImagesClient({ b64: "xx" });
    const disabled = await withEnv({ AI_PRODUCT_STUDIO_ENABLED: "false" }, () =>
      generateProductImage({ prompt: "prueba", referenceImageUrl: REFERENCE_URL }, { client })
    );
    assert(!disabled.ok && disabled.code === "disabled", "AI_PRODUCT_STUDIO_ENABLED=false -> error claro");

    const notConfigured = await withEnv({ AI_PRODUCT_STUDIO_ENABLED: "true", OPENAI_API_KEY: "" }, () =>
      generateProductImage({ prompt: "prueba", referenceImageUrl: REFERENCE_URL }, { client })
    );
    assert(!notConfigured.ok && notConfigured.code === "not_configured", "sin OPENAI_API_KEY -> error claro");
  }

  // ── [7] Utilidades puras de metadata (uploadApprovedImage.ts) ──────────────
  console.log("\n[7] Metadata ASCII-safe para R2 (uploadApprovedImage.ts)");
  {
    const encoded = toAsciiMetadataValue("Muele café en una cocina pequeña, ñoño ✨");
    assert(/^[\x00-\x7F]*$/.test(encoded), "el valor codificado es 100% ASCII (headers S3 no soportan UTF-8 crudo)");
    assert(decodeURIComponent(encoded).includes("café"), "el valor original (con tildes) se recupera al decodificar");

    const longValue = "x".repeat(1000);
    const truncated = toAsciiMetadataValue(longValue, 50);
    assert(truncated.length <= 50, `se recorta al largo máximo pedido (obtuvo largo ${truncated.length})`);

    assert(extensionForMimeType("image/png") === "png", "image/png -> .png");
    assert(extensionForMimeType("image/webp") === "webp", "image/webp -> .webp");
    assert(extensionForMimeType("image/jpeg") === "jpg", "image/jpeg -> .jpg");
  }

  if (failures > 0) {
    console.error(`\n${failures} aserción(es) fallaron.`);
    process.exitCode = 1;
  } else {
    console.log(
      "\nTodas las aserciones pasaron. Nunca se llamó a OpenAI real ni se tocó Neon/R2 (la subida real a R2 de " +
        "uploadApprovedAIImage no se ejercita acá — mismo criterio que el resto de este proyecto, que no mockea el cliente S3/R2)."
    );
    process.exitCode = 0;
  }
}

main().catch((error) => {
  console.error("\n[verify-ai-studio-image-generation] Error:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
