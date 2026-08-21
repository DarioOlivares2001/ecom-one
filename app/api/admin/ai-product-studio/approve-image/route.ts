import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFromCookies } from "@/lib/admin/session";
import { extractR2KeyFromPublicUrl } from "@/lib/storage/r2";
import { uploadApprovedAIImage } from "@/lib/ai-product-studio/visualEnhancement/uploadApprovedImage";

export const runtime = "nodejs";

const PRODUCT_IMAGE_PREFIX = "products/";
const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

const bodySchema = z.object({
  dataUrl: z.string().min(1),
  sectionId: z.string().min(1),
  sectionType: z.string().min(1),
  prompt: z.string().min(1).max(1000),
  referenceImageUrl: z.string().url(),
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
