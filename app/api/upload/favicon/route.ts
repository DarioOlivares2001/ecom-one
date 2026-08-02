import { NextResponse } from "next/server";
import { compressIconImage } from "@/lib/images/compressIconImage";
import { isAllowedImageMimeType, isR2Configured, MAX_UPLOAD_BYTES, uploadToR2 } from "@/lib/storage/r2";

export const runtime = "nodejs";

const PATH_PREFIX = "favicons/";

/** Los 3 tamaños que se generan desde una sola imagen subida. */
const SIZES = [
  { key: "favicon", sizePx: 32 },
  { key: "apple", sizePx: 180 },
  { key: "pwa", sizePx: 512 },
] as const;

export async function POST(req: Request) {
  try {
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
      return NextResponse.json({ error: "El archivo supera el tamaño máximo permitido (10 MB)." }, { status: 400 });
    }

    const originalBytes = file.size;
    const arrayBuf = await file.arrayBuffer();
    const input = Buffer.from(arrayBuf);
    const ts = Date.now();

    const urls: Record<string, string> = {};

    for (const { key: sizeKey, sizePx } of SIZES) {
      const { buffer } = await compressIconImage(input, sizePx);
      const key = `${PATH_PREFIX}${sizeKey}-${sizePx}-${ts}.png`;
      urls[sizeKey] = await uploadToR2({ key, body: buffer, contentType: "image/png" });
    }

    return NextResponse.json({
      faviconUrl: urls.favicon,
      appleIconUrl: urls.apple,
      pwaIconUrl: urls.pwa,
      originalBytes,
    });
  } catch (e) {
    console.error("[favicon-upload-error]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}
