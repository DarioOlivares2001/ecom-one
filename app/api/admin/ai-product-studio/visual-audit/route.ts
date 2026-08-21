import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFromCookies } from "@/lib/admin/session";
import { extractR2KeyFromPublicUrl } from "@/lib/storage/r2";
import { aiProductDraftSchema } from "@/lib/ai-product-studio/schema";
import {
  generateVisualAudit,
  type GenerateVisualAuditErrorCode,
} from "@/lib/ai-product-studio/visualEnhancement/generateVisualAudit";

export const runtime = "nodejs";

const PRODUCT_IMAGE_PREFIX = "products/";

const bodySchema = z.object({
  draft: aiProductDraftSchema,
  /** Fotos reales del proveedor ya subidas a la biblioteca — nunca imágenes IA de una ronda anterior. */
  referencePhotos: z.array(z.string().url()).max(6),
});

const ERROR_STATUS: Record<GenerateVisualAuditErrorCode, number> = {
  disabled: 503,
  not_configured: 503,
  timeout: 504,
  api_error: 502,
  invalid_response: 502,
};

/**
 * Nivel 3 del Estudio IA de Producto — "Mejora visual y persuasiva de la
 * ficha", paso 1: auditoría. Analiza el borrador YA generado y las fotos
 * reales del proveedor y propone qué hacer con cada sección — nunca genera
 * ni sube ninguna imagen todavía. Protegida con la misma sesión de admin que
 * el resto de `/admin`.
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

    // Cada foto de referencia debe ser un objeto real del bucket R2 de este
    // proyecto, bajo products/ — nunca una URL arbitraria inyectada por el cliente.
    for (const url of parsed.data.referencePhotos) {
      const key = extractR2KeyFromPublicUrl(url);
      if (!key || !key.startsWith(PRODUCT_IMAGE_PREFIX)) {
        return NextResponse.json(
          { error: "Una de las fotos de referencia no pertenece a la biblioteca de este proyecto." },
          { status: 400 }
        );
      }
    }

    const result = await generateVisualAudit(parsed.data.draft, parsed.data.referencePhotos);
    if (!result.ok) {
      console.error("[ai-product-studio][visual-audit] error:", { code: result.code, adminId: session.id });
      return NextResponse.json({ error: result.error, code: result.code }, { status: ERROR_STATUS[result.code] });
    }

    return NextResponse.json({ audit: result.audit });
  } catch (err) {
    console.error("[ai-product-studio][visual-audit] excepción:", err);
    return NextResponse.json({ error: "Error interno al analizar la ficha." }, { status: 500 });
  }
}
