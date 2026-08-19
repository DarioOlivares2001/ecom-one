import { aiProductDraftSchema, type AIProductDraft } from "./schema";
import { commercialDataSchema, type CommercialData } from "./commercialData";

/**
 * Puente entre el asistente de pantalla completa (`/admin/productos/crear-con-ia`)
 * y el formulario manual (`/admin/productos/nuevo`), vía `sessionStorage` — no
 * hay backend/estado compartido entre rutas de Next.js, así que "Aplicar al
 * borrador" escribe acá antes de navegar, y `nuevo/page.tsx` lo lee (y borra)
 * al montar. Si el borrador guardado no valida contra el schema actual (ej.
 * quedó de una versión anterior), se descarta silenciosamente y el formulario
 * manual arranca en blanco como siempre — nunca se aplica un borrador a medias.
 */

const BRIDGE_KEY = "ai_product_studio_pending_draft";

export interface AIStudioBridgePayload {
  draft: AIProductDraft;
  /** Biblioteca completa subida durante el asistente (`product_media`), no solo la galería elegida. */
  productMedia: string[];
  /** Precio, stock, costo y enlace Dropi — completados a mano por el admin, nunca generados por la IA. */
  commercial?: CommercialData;
}

export function writeAIStudioBridge(payload: AIStudioBridgePayload): void {
  try {
    sessionStorage.setItem(BRIDGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("[ai-product-studio] no se pudo escribir el puente a sessionStorage:", error);
  }
}

export function readAndClearAIStudioBridge(): AIStudioBridgePayload | null {
  try {
    const raw = sessionStorage.getItem(BRIDGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(BRIDGE_KEY);

    const parsed = JSON.parse(raw) as { draft?: unknown; productMedia?: unknown; commercial?: unknown };
    const draftResult = aiProductDraftSchema.safeParse(parsed.draft);
    if (!draftResult.success) return null;

    const productMedia = Array.isArray(parsed.productMedia)
      ? parsed.productMedia.filter((u): u is string => typeof u === "string")
      : [];

    let commercial: CommercialData | undefined;
    if (parsed.commercial !== undefined) {
      const commercialResult = commercialDataSchema.safeParse(parsed.commercial);
      if (commercialResult.success) commercial = commercialResult.data;
    }

    return { draft: draftResult.data, productMedia, commercial };
  } catch {
    return null;
  }
}
