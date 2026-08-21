import "server-only";

import OpenAI, { APIConnectionTimeoutError, APIError, toFile } from "openai";

import { getAIProductStudioImageModel, getOpenAIApiKey, isAIProductStudioEnabled } from "../openaiConfig";
import { isAllowedImageMimeType } from "@/lib/storage/r2";

const REQUEST_TIMEOUT_MS = 60_000;
const IMAGE_SIZE = "1024x1024";
const IMAGE_QUALITY = "medium";
const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;

/** Interfaz mínima inyectable — mismo principio que `AIProductStudioOpenAIClient` en `generateAIDraft.ts`: permite mockear en tests sin tocar OpenAI real ni gastar cuota. */
export interface AIImageGenerationClient {
  images: {
    edit: (
      params: Record<string, unknown>,
      options?: { timeout?: number }
    ) => Promise<{ data?: Array<{ b64_json?: string }> }>;
  };
}

export type GenerateProductImageErrorCode =
  | "disabled"
  | "not_configured"
  | "invalid_prompt"
  | "reference_fetch_failed"
  | "timeout"
  | "quota_exceeded"
  | "api_error"
  | "invalid_response";

export type GenerateProductImageResult =
  | { ok: true; base64: string; mimeType: string }
  | { ok: false; code: GenerateProductImageErrorCode; error: string };

let cachedClient: AIImageGenerationClient | null = null;
function getDefaultClient(): AIImageGenerationClient {
  if (cachedClient) return cachedClient;
  cachedClient = new OpenAI({ apiKey: getOpenAIApiKey() }) as unknown as AIImageGenerationClient;
  return cachedClient;
}

/**
 * Prefijo de seguridad que se antepone SIEMPRE al prompt del admin — nunca
 * se omite ni se puede sobreescribir desde el cliente. Esta instrucción, no
 * el prompt del admin, es la defensa real de "nunca cambiar forma, piezas,
 * marca o proporciones del producto real": el prompt del admin solo debe
 * describir entorno/contexto.
 */
function buildSafePrompt(adminPrompt: string): string {
  return [
    "Edita la imagen de referencia manteniendo EXACTAMENTE el producto real: misma forma, proporciones, controles, piezas, marca visible, color y materiales aparentes. No agregues, quites ni cambies ninguna parte del producto. No inventes texto, logotipos ni etiquetas nuevas visibles.",
    `Cambia únicamente el entorno, fondo, iluminación o contexto de uso según esta instrucción: ${adminPrompt.trim()}`,
    "El resultado debe ser una fotografía de producto realista, sin marcas de agua ni texto superpuesto.",
  ].join(" ");
}

async function fetchReferenceImage(
  url: string
): Promise<{ ok: true; buffer: Buffer; mimeType: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: `No se pudo leer la foto de referencia (HTTP ${res.status}).` };
    const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!isAllowedImageMimeType(contentType)) {
      return { ok: false, error: "La foto de referencia no es un formato de imagen soportado." };
    }
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_REFERENCE_BYTES) {
      return { ok: false, error: "La foto de referencia es demasiado grande." };
    }
    return { ok: true, buffer: Buffer.from(arrayBuffer), mimeType: contentType };
  } catch {
    return { ok: false, error: "No se pudo descargar la foto de referencia." };
  }
}

/**
 * Genera UNA imagen complementaria por edición sobre una foto real del
 * proveedor (`images.edit` con `input_fidelity: "high"`, nunca texto-a-imagen
 * desde cero) — nunca sube nada a R2 ni la asocia a ninguna sección: eso
 * ocurre solo si el admin aprueba explícitamente el resultado (ver
 * `uploadApprovedImage.ts`).
 */
export async function generateProductImage(
  input: { prompt: string; referenceImageUrl: string },
  options: { client?: AIImageGenerationClient } = {}
): Promise<GenerateProductImageResult> {
  if (!isAIProductStudioEnabled()) {
    return { ok: false, code: "disabled", error: "El Estudio IA de Producto no está habilitado (AI_PRODUCT_STUDIO_ENABLED)." };
  }
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    return { ok: false, code: "not_configured", error: "Falta configurar OPENAI_API_KEY en el servidor." };
  }
  const prompt = input.prompt.trim();
  if (!prompt) {
    return { ok: false, code: "invalid_prompt", error: "El prompt no puede estar vacío." };
  }

  const reference = await fetchReferenceImage(input.referenceImageUrl);
  if (!reference.ok) {
    return { ok: false, code: "reference_fetch_failed", error: reference.error };
  }

  const model = getAIProductStudioImageModel();
  const client = options.client ?? getDefaultClient();
  const safePrompt = buildSafePrompt(prompt);

  try {
    const file = await toFile(reference.buffer, "reference-photo", { type: reference.mimeType });
    const response = await client.images.edit(
      {
        model,
        image: file,
        prompt: safePrompt,
        size: IMAGE_SIZE,
        quality: IMAGE_QUALITY,
        input_fidelity: "high",
        n: 1,
      },
      { timeout: REQUEST_TIMEOUT_MS }
    );
    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      return { ok: false, code: "invalid_response", error: "OpenAI no devolvió una imagen." };
    }
    return { ok: true, base64: b64, mimeType: "image/png" };
  } catch (err) {
    if (err instanceof APIConnectionTimeoutError) {
      return { ok: false, code: "timeout", error: "OpenAI no respondió a tiempo generando la imagen. Intenta de nuevo." };
    }
    if (err instanceof APIError) {
      if (err.status === 429) {
        return {
          ok: false,
          code: "quota_exceeded",
          error: "Se alcanzó el límite de cuota de generación de imágenes de OpenAI. Intenta más tarde.",
        };
      }
      console.error("[ai-product-studio][generate-image] error de la API de OpenAI:", { status: err.status, message: err.message });
      return { ok: false, code: "api_error", error: "OpenAI devolvió un error al generar la imagen. Intenta de nuevo." };
    }
    console.error("[ai-product-studio][generate-image] error inesperado llamando a OpenAI:", err);
    return { ok: false, code: "api_error", error: "No se pudo generar la imagen. Intenta de nuevo." };
  }
}
