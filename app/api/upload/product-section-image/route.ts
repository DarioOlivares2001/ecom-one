import { NextResponse } from "next/server";
import { isAllowedImageMimeType, isR2Configured, MAX_UPLOAD_BYTES, uploadToR2 } from "@/lib/storage/r2";
import { getAdminSessionFromCookies } from "@/lib/admin/session";

export const runtime = "nodejs";

const PATH_PREFIX = "product-sections/";

/**
 * Sube una imagen para un bloque modular de la ficha (secuencia visual,
 * comparador antes/después). Mismo bucket/credenciales R2 que el resto del
 * admin — no hay pegado manual de URL, el mantenedor solo elige el archivo.
 */
export async function POST(req: Request) {
  try {
    const session = getAdminSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    if (!isR2Configured()) {
      return NextResponse.json(
        { error: "Cloudflare R2 no está configurado todavía. Ver R2_SETUP.md." },
        { status: 503 }
      );
    }

    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Se espera multipart/form-data" }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }
    if (!isAllowedImageMimeType(file.type)) {
      return NextResponse.json(
        { error: "Formato no permitido. Usa JPEG, PNG, WebP o GIF." },
        { status: 400 }
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "El archivo supera el tamaño máximo permitido (10 MB)." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const key = `${PATH_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const url = await uploadToR2({ key, body: buffer, contentType: file.type });

    return NextResponse.json({ url });
  } catch (e) {
    console.error("[product-section-image-upload-error]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}
