import { NextResponse } from "next/server";
import { compressHeroImage, type HeroBannerKind } from "@/lib/images/compressHeroImage";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Bucket dedicado para banners de hero. */
const BUCKET = "store-assets";
const PATH_PREFIX = "hero-banners/";

function formatStorageUploadError(raw: string, bucketId: string): string {
  const lower = raw.toLowerCase();
  const looksLikeMissingBucket =
    lower.includes("bucket not found") ||
    (lower.includes("bucket") && lower.includes("not found")) ||
    lower.includes("resource not found");
  if (looksLikeMissingBucket) {
    return `No existe el bucket "${bucketId}" en Supabase Storage. Crea el bucket en el dashboard (Storage → New bucket) o, si usas otro nombre, ajusta la constante BUCKET en app/api/upload/hero/route.ts.`;
  }
  return raw;
}

const ALLOWED = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(req: Request) {
  try {
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
    console.log("[hero-upload] type", type);

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }
    console.log("[hero-upload] file received", {
      name: file.name,
      mime: file.type,
      bytes: file.size,
    });

    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: "Formato no permitido. Usa JPEG, PNG, WebP o GIF." },
        { status: 400 }
      );
    }

    const originalBytes = file.size;
    const arrayBuf = await file.arrayBuffer();
    const input = Buffer.from(arrayBuf);

    const { buffer, mimeType, bytes, qualityUsed } = await compressHeroImage(input, type);
    console.log("[hero-upload] optimized size", {
      originalBytes,
      optimizedBytes: bytes,
      qualityUsed,
      mimeType,
    });

    const ts = Date.now();
    const path =
      type === "desktop"
        ? `${PATH_PREFIX}hero-desktop-${ts}.webp`
        : `${PATH_PREFIX}hero-mobile-${ts}.webp`;
    console.log("[hero-upload] bucket", BUCKET);
    console.log("[hero-upload] path", path);

    const supabase = createAdminClient();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: "image/webp",
        upsert: true,
        cacheControl: "31536000",
      });

    if (uploadError) {
      console.error("[hero-upload-error]", uploadError);
      const friendly = formatStorageUploadError(uploadError.message, BUCKET);
      return NextResponse.json({ error: friendly }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path);
    console.log("[hero-upload] publicUrl", publicUrl);

    return NextResponse.json({
      url: publicUrl,
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
