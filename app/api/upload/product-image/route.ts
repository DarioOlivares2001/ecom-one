import { NextResponse } from "next/server";
import {
  deleteFromR2,
  extractR2KeyFromPublicUrl,
  isAllowedImageMimeType,
  isR2Configured,
  MAX_UPLOAD_BYTES,
  uploadToR2,
} from "@/lib/storage/r2";
import { getAdminSessionFromCookies } from "@/lib/admin/session";

export const runtime = "nodejs";

const PATH_PREFIX = "products/";

/**
 * Sube una imagen a la biblioteca de medios del producto (galería principal
 * y bloques modulares de la ficha comparten el mismo `products.images`).
 * Mismo bucket/credenciales R2 que el resto del admin — no hay pegado manual
 * de URL, el mantenedor solo elige el archivo y luego la reutiliza donde
 * quiera desde la biblioteca.
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
    console.error("[product-image-upload-error]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}

/**
 * Borra un objeto de R2 por URL pública. Uso previsto: limpieza best-effort
 * del Estudio IA de Producto cuando se cancela el asistente antes de aplicar
 * el borrador (las imágenes subidas durante esa sesión nunca llegaron a
 * quedar referenciadas en `products`, así que no hay nada que desligar en la
 * base — solo el objeto físico en R2 queda huérfano si no se limpia).
 *
 * Doble candado de seguridad, nunca borra fuera de esto:
 *  1. `extractR2KeyFromPublicUrl` rechaza cualquier URL que no pertenezca al
 *     bucket configurado de este proyecto (nunca borra de otro origen).
 *  2. Solo acepta keys bajo el prefijo `products/` — no puede borrar `hero/`,
 *     `logo/` ni `favicon/`, aunque alguien pasara esa URL a mano.
 * Es responsabilidad del caller no invocar esto sobre una URL que ya haya
 * quedado guardada en `products.images`/`product_media` de un producto real.
 */
export async function DELETE(req: Request) {
  try {
    const session = getAdminSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    if (!isR2Configured()) {
      return NextResponse.json({ error: "Cloudflare R2 no está configurado." }, { status: 503 });
    }

    const body = (await req.json().catch(() => ({}))) as { url?: string };
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json({ error: "url requerida" }, { status: 400 });
    }

    const key = extractR2KeyFromPublicUrl(url);
    if (!key || !key.startsWith(PATH_PREFIX)) {
      return NextResponse.json({ error: "URL fuera del alcance permitido para borrado." }, { status: 400 });
    }

    await deleteFromR2(key);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[product-image-delete-error]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}
