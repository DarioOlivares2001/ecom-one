import { NextResponse } from "next/server";
import { compressLogoImage, type LogoKind } from "@/lib/images/compressLogoImage";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "store-assets";
const PATH_PREFIX = "logos/";

const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);

function formatStorageUploadError(raw: string, bucketId: string): string {
  const lower = raw.toLowerCase();
  const looksLikeMissingBucket =
    lower.includes("bucket not found") ||
    (lower.includes("bucket") && lower.includes("not found")) ||
    lower.includes("resource not found");
  if (looksLikeMissingBucket) {
    return `No existe el bucket "${bucketId}" en Supabase Storage. Crea el bucket en el dashboard (Storage → New bucket) o ajusta la constante BUCKET en app/api/upload/logo/route.ts.`;
  }
  return raw;
}

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Se espera multipart/form-data" }, { status: 400 });
    }

    const form = await req.formData();
    const typeRaw = String(form.get("type") ?? "");
    if (typeRaw !== "horizontal" && typeRaw !== "square") {
      return NextResponse.json({ error: "type debe ser horizontal o square" }, { status: 400 });
    }
    const type = typeRaw as LogoKind;

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: "Formato no permitido. Usa JPEG, PNG, WebP o GIF." },
        { status: 400 }
      );
    }

    const originalBytes = file.size;
    const arrayBuf = await file.arrayBuffer();
    const input = Buffer.from(arrayBuf);

    const { buffer, bytes, qualityUsed } = await compressLogoImage(input, type);

    const ts = Date.now();
    const path = `${PATH_PREFIX}logo-${type}-${ts}.webp`;

    const supabase = createAdminClient();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: "image/webp",
        upsert: true,
        cacheControl: "31536000",
      });

    if (uploadError) {
      console.error("[logo-upload-error]", uploadError);
      const friendly = formatStorageUploadError(uploadError.message, BUCKET);
      return NextResponse.json({ error: friendly }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path);

    return NextResponse.json({
      url: publicUrl,
      originalBytes,
      optimizedBytes: bytes,
      qualityUsed,
    });
  } catch (e) {
    console.error("[logo-upload-error]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}
