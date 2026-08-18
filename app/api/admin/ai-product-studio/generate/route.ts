import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionFromCookies } from "@/lib/admin/session";
import { extractR2KeyFromPublicUrl } from "@/lib/storage/r2";
import { aiProductStudioInputSchema } from "@/lib/ai-product-studio/schema";
import { generateAIDraft, type GenerateAIDraftErrorCode } from "@/lib/ai-product-studio/generateAIDraft";

export const runtime = "nodejs";

const PRODUCT_IMAGE_PREFIX = "products/";

const ERROR_STATUS: Record<GenerateAIDraftErrorCode, number> = {
  disabled: 503,
  not_configured: 503,
  timeout: 504,
  api_error: 502,
  invalid_response: 502,
};

/**
 * Genera un borrador de ficha de producto con OpenAI (Estudio IA de
 * Producto, Fase 2). Protegida con la misma sesión de admin que el resto de
 * `/admin` — nunca expone `OPENAI_API_KEY` ni detalles internos del error.
 * No crea, guarda ni publica ningún producto: solo devuelve el borrador
 * para que el asistente lo muestre en la vista previa editable.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getAdminSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsedInput = aiProductStudioInputSchema.safeParse(body);
    if (!parsedInput.success) {
      return NextResponse.json(
        { error: parsedInput.error.issues[0]?.message ?? "Datos de entrada inválidos." },
        { status: 400 }
      );
    }
    const input = parsedInput.data;

    // Cada imagen debe ser un objeto real del bucket R2 de este proyecto,
    // bajo el prefijo products/ — nunca se envía a OpenAI una URL arbitraria
    // que el cliente pudiera haber inyectado.
    for (const url of input.selectedImages) {
      const key = extractR2KeyFromPublicUrl(url);
      if (!key || !key.startsWith(PRODUCT_IMAGE_PREFIX)) {
        return NextResponse.json(
          { error: "Una de las imágenes seleccionadas no pertenece a la biblioteca de este proyecto." },
          { status: 400 }
        );
      }
    }

    const result = await generateAIDraft(input);
    if (!result.ok) {
      console.error("[ai-product-studio][generate] error:", { code: result.code, adminId: session.id });
      return NextResponse.json({ error: result.error, code: result.code }, { status: ERROR_STATUS[result.code] });
    }

    return NextResponse.json({ draft: result.draft });
  } catch (err) {
    console.error("[ai-product-studio][generate] excepción:", err);
    return NextResponse.json({ error: "Error interno al generar el borrador." }, { status: 500 });
  }
}
