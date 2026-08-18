import "server-only";

/**
 * Configuración del Estudio IA de Producto (Fase 2 — OpenAI real). Solo
 * servidor, mismo patrón que `lib/flow/config.ts`: constantes leídas una vez
 * de `process.env`, nunca expuestas al navegador (sin prefijo NEXT_PUBLIC_*).
 *
 * `AI_PRODUCT_STUDIO_API_KEY` nunca se loguea, no se devuelve en ninguna
 * respuesta HTTP, y no viaja fuera de `lib/ai-product-studio/generateAIDraft.ts`.
 */

export const AI_PRODUCT_STUDIO_DEFAULT_MODEL = "gpt-5.6-terra";

export function isAIProductStudioEnabled(): boolean {
  return (process.env.AI_PRODUCT_STUDIO_ENABLED ?? "").trim().toLowerCase() === "true";
}

export function getOpenAIApiKey(): string {
  return process.env.OPENAI_API_KEY?.trim() ?? "";
}

export function getAIProductStudioModel(): string {
  return process.env.AI_PRODUCT_STUDIO_MODEL?.trim() || AI_PRODUCT_STUDIO_DEFAULT_MODEL;
}
