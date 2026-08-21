import { aiProductDraftSchema, type AIProductDraft } from "./schema";
import { commercialDataSchema, type CommercialData } from "./commercialData";

/**
 * Puente entre el asistente de pantalla completa (`/admin/productos/crear-con-ia`)
 * y el formulario manual (`/admin/productos/nuevo`), vía `sessionStorage` — no
 * hay backend/estado compartido entre rutas de Next.js, así que "Continuar a
 * revisión" escribe acá antes de navegar, y `nuevo/page.tsx` lo lee (y borra)
 * al montar. Ningún producto se crea en este paso — el puente solo transporta
 * datos entre dos pantallas; la fila real de `products` recién se crea si el
 * admin llega hasta el final del formulario manual y confirma "Guardar".
 *
 * `readAndClearAIStudioBridge` distingue explícitamente "no venía nada del
 * asistente" (`absent`, el caso normal al entrar directo a /nuevo) de "venía
 * algo pero no se pudo leer/validar" (`invalid`, ej. quedó de una versión
 * anterior o sessionStorage se corrompió) — antes ambos casos devolvían
 * `null` indistinguibles, y el formulario manual quedaba en blanco sin
 * avisar que la transferencia había fallado.
 */

const BRIDGE_KEY = "ai_product_studio_pending_draft";

export interface AIStudioBridgePayload {
  draft: AIProductDraft;
  /** Biblioteca completa subida durante el asistente (`product_media`), no solo la galería elegida. */
  productMedia: string[];
  /** Precio, stock, costo y enlace Dropi — completados a mano por el admin, nunca generados por la IA. */
  commercial?: CommercialData;
  /** URLs (dentro de `productMedia`/`draft`) que son imágenes generadas por IA ya aprobadas por el admin (Nivel 3) — solo para mostrar la insignia "Generada con IA" en el formulario manual. */
  aiGeneratedImageUrls?: string[];
}

export type AIStudioBridgeReadResult =
  | { status: "absent" }
  | { status: "invalid" }
  | { status: "ok"; payload: AIStudioBridgePayload };

/** true si se pudo escribir en sessionStorage — el caller debe avisar y NO navegar si esto devuelve false. */
export function writeAIStudioBridge(payload: AIStudioBridgePayload): boolean {
  try {
    sessionStorage.setItem(BRIDGE_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn("[ai-product-studio] no se pudo escribir el puente a sessionStorage:", error);
    return false;
  }
}

export function readAndClearAIStudioBridge(): AIStudioBridgeReadResult {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(BRIDGE_KEY);
  } catch {
    return { status: "absent" };
  }
  if (!raw) return { status: "absent" };
  sessionStorage.removeItem(BRIDGE_KEY);

  try {
    const parsed = JSON.parse(raw) as {
      draft?: unknown;
      productMedia?: unknown;
      commercial?: unknown;
      aiGeneratedImageUrls?: unknown;
    };
    const draftResult = aiProductDraftSchema.safeParse(parsed.draft);
    if (!draftResult.success) return { status: "invalid" };

    const productMedia = Array.isArray(parsed.productMedia)
      ? parsed.productMedia.filter((u): u is string => typeof u === "string")
      : [];

    let commercial: CommercialData | undefined;
    if (parsed.commercial !== undefined) {
      const commercialResult = commercialDataSchema.safeParse(parsed.commercial);
      if (commercialResult.success) commercial = commercialResult.data;
    }

    const aiGeneratedImageUrls = Array.isArray(parsed.aiGeneratedImageUrls)
      ? parsed.aiGeneratedImageUrls.filter((u): u is string => typeof u === "string")
      : [];

    return { status: "ok", payload: { draft: draftResult.data, productMedia, commercial, aiGeneratedImageUrls } };
  } catch {
    return { status: "invalid" };
  }
}
