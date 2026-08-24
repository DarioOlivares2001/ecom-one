import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFromCookies } from "@/lib/admin/session";
import { extractR2KeyFromPublicUrl } from "@/lib/storage/r2";
import { uploadApprovedAIImage } from "@/lib/ai-product-studio/visualEnhancement/uploadApprovedImage";
import { AI_PRODUCT_STUDIO_MAX_PROMPT_LENGTH } from "@/lib/ai-product-studio/visualEnhancement/types";

export const runtime = "nodejs";

const PRODUCT_IMAGE_PREFIX = "products/";
const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

const bodySchema = z.object({
  dataUrl: z.string().min(1, "Falta la imagen generada."),
  sectionId: z.string().min(1, "Falta el id de la sección."),
  sectionType: z.string().min(1, "Falta el tipo de sección."),
  // Mismo límite que generate-image/route.ts — este prompt es el mismo que ya
  // se usó para generar (se reenvía tal cual para guardarlo como metadata),
  // así que nunca puede ser MÁS estricto o una generación válida no se podría aprobar.
  prompt: z
    .string()
    .min(1, "El prompt no puede estar vacío.")
    .max(AI_PRODUCT_STUDIO_MAX_PROMPT_LENGTH, `El prompt no puede superar los ${AI_PRODUCT_STUDIO_MAX_PROMPT_LENGTH} caracteres.`),
  referenceImageUrl: z.string().url("La foto de referencia debe ser una URL válida."),
});

/**
 * Nivel 3, paso 3: sube a R2 una imagen IA que el admin ya aprobó
 * explícitamente (clic en "Usar en esta sección" o "Agregar a biblioteca" en
 * el asistente) — es el ÚNICO punto de todo este flujo que efectivamente
 * escribe en R2. Nunca se llama automáticamente tras generar.
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

    const match = parsed.data.dataUrl.match(DATA_URL_PATTERN);
    if (!match) {
      return NextResponse.json({ error: "La imagen a aprobar no tiene un formato válido." }, { status: 400 });
    }
    const [, mimeType, base64] = match;

    // La referencia también debe pertenecer a este proyecto — misma regla que en generate-image.
    const refKey = extractR2KeyFromPublicUrl(parsed.data.referenceImageUrl);
    if (!refKey || !refKey.startsWith(PRODUCT_IMAGE_PREFIX)) {
      return NextResponse.json(
        { error: "La foto de referencia no pertenece a la biblioteca de este proyecto." },
        { status: 400 }
      );
    }

    const approved = await uploadApprovedAIImage({
      base64,
      mimeType,
      sectionId: parsed.data.sectionId,
      sectionType: parsed.data.sectionType,
      prompt: parsed.data.prompt,
      referenceImageUrl: parsed.data.referenceImageUrl,
    });

    console.log(`[ai-product-studio][approve-image] imagen aprobada por admin=${session.id}: ${approved.url}`);

    return NextResponse.json({ image: approved });
  } catch (err) {
    console.error("[ai-product-studio][approve-image] excepción:", err);
    return NextResponse.json({ error: "No se pudo guardar la imagen aprobada." }, { status: 500 });
  }
}
