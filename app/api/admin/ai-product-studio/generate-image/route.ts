import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFromCookies } from "@/lib/admin/session";
import { extractR2KeyFromPublicUrl } from "@/lib/storage/r2";
import {
  AI_PRODUCT_STUDIO_MAX_IMAGES_PER_DRAFT,
  AI_PRODUCT_STUDIO_MAX_PROMPT_LENGTH,
} from "@/lib/ai-product-studio/visualEnhancement/types";
import {
  generateProductImage,
  type GenerateProductImageErrorCode,
} from "@/lib/ai-product-studio/visualEnhancement/generateProductImage";

export const runtime = "nodejs";

const PRODUCT_IMAGE_PREFIX = "products/";

const bodySchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, "El prompt no puede estar vacío.")
    .max(AI_PRODUCT_STUDIO_MAX_PROMPT_LENGTH, `El prompt no puede superar los ${AI_PRODUCT_STUDIO_MAX_PROMPT_LENGTH} caracteres.`),
  referenceImageUrl: z.string().url("La foto de referencia debe ser una URL válida."),
  /** Cuántas imágenes IA ya se generaron en esta ficha (contador llevado por el cliente) — defensa adicional al límite ya aplicado en la UI. */
  alreadyGeneratedCount: z.number().int().min(0).max(1000),
});

const ERROR_STATUS: Record<GenerateProductImageErrorCode, number> = {
  disabled: 503,
  not_configured: 503,
  invalid_prompt: 400,
  reference_fetch_failed: 400,
  timeout: 504,
  quota_exceeded: 429,
  api_error: 502,
  invalid_response: 502,
};

/**
 * Nivel 3, paso 2: genera UNA imagen complementaria por edición sobre una
 * foto real del proveedor. Nunca sube nada a R2 ni la asocia a la ficha —
 * devuelve solo un `data:` URL en memoria para que el admin lo revise y
 * decida (`approve-image` es el único camino que persiste algo). Máximo
 * `AI_PRODUCT_STUDIO_MAX_IMAGES_PER_DRAFT` por ficha, reforzado acá aunque
 * la UI ya lo controle.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getAdminSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos de entrada inválidos." },
        { status: 400 }
      );
    }

    if (parsed.data.alreadyGeneratedCount >= AI_PRODUCT_STUDIO_MAX_IMAGES_PER_DRAFT) {
      return NextResponse.json(
        { error: `Ya generaste el máximo de ${AI_PRODUCT_STUDIO_MAX_IMAGES_PER_DRAFT} imágenes IA para esta ficha.` },
        { status: 429 }
      );
    }

    const key = extractR2KeyFromPublicUrl(parsed.data.referenceImageUrl);
    if (!key || !key.startsWith(PRODUCT_IMAGE_PREFIX)) {
      return NextResponse.json(
        { error: "La foto de referencia no pertenece a la biblioteca de este proyecto." },
        { status: 400 }
      );
    }

    const result = await generateProductImage({
      prompt: parsed.data.prompt,
      referenceImageUrl: parsed.data.referenceImageUrl,
    });
    if (!result.ok) {
      console.error("[ai-product-studio][generate-image] error:", { code: result.code, adminId: session.id });
      return NextResponse.json({ error: result.error, code: result.code }, { status: ERROR_STATUS[result.code] });
    }

    return NextResponse.json({ dataUrl: `data:${result.mimeType};base64,${result.base64}` });
  } catch (err) {
    console.error("[ai-product-studio][generate-image] excepción:", err);
    return NextResponse.json({ error: "Error interno al generar la imagen." }, { status: 500 });
  }
}
