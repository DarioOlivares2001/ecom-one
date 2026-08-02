import { NextResponse } from "next/server";
import { compressIconImage } from "@/lib/images/compressIconImage";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "store-assets";
const PATH_PREFIX = "favicons/";

const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);

/** Los 3 tamaños que se generan desde una sola imagen subida. */
const SIZES = [
  { key: "favicon", sizePx: 32 },
  { key: "apple", sizePx: 180 },
  { key: "pwa", sizePx: 512 },
] as const;

function formatStorageUploadError(raw: string, bucketId: string): string {
  const lower = raw.toLowerCase();
  const looksLikeMissingBucket =
    lower.includes("bucket not found") ||
    (lower.includes("bucket") && lower.includes("not found")) ||
    lower.includes("resource not found");
  if (looksLikeMissingBucket) {
    return `No existe el bucket "${bucketId}" en Supabase Storage. Crea el bucket en el dashboard (Storage → New bucket) o ajusta la constante BUCKET en app/api/upload/favicon/route.ts.`;
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
    const supabase = createAdminClient();
    const ts = Date.now();

    const urls: Record<string, string> = {};

    for (const { key, sizePx } of SIZES) {
      const { buffer } = await compressIconImage(input, sizePx);
      const path = `${PATH_PREFIX}${key}-${sizePx}-${ts}.png`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, buffer, {
          contentType: "image/png",
          upsert: true,
          cacheControl: "31536000",
        });

      if (uploadError) {
        console.error("[favicon-upload-error]", uploadError);
        const friendly = formatStorageUploadError(uploadError.message, BUCKET);
        return NextResponse.json({ error: friendly }, { status: 500 });
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path);
      urls[key] = publicUrl;
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
