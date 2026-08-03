import { NextResponse } from "next/server";
import { compressHeroImage, type HeroBannerKind } from "@/lib/images/compressHeroImage";
import { isAllowedImageMimeType, isR2Configured, MAX_UPLOAD_BYTES, uploadToR2 } from "@/lib/storage/r2";
import { getAdminSessionFromCookies } from "@/lib/admin/session";

export const runtime = "nodejs";

const PATH_PREFIX = "hero-banners/";

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
    const typeRaw = String(form.get("type") ?? "");
    if (typeRaw !== "desktop" && typeRaw !== "mobile") {
      return NextResponse.json({ error: "type debe ser desktop o mobile" }, { status: 400 });
    }
    const type = typeRaw as HeroBannerKind;

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

    const { buffer, mimeType, bytes, qualityUsed } = await compressHeroImage(input, type);

    const ts = Date.now();
    const key =
      type === "desktop"
        ? `${PATH_PREFIX}hero-desktop-${ts}.webp`
        : `${PATH_PREFIX}hero-mobile-${ts}.webp`;

    const url = await uploadToR2({ key, body: buffer, contentType: mimeType || "image/webp" });

    return NextResponse.json({
      url,
      originalBytes,
      optimizedBytes: bytes,
      qualityUsed,
    });
  } catch (e) {
    console.error("[hero-upload-error]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}
