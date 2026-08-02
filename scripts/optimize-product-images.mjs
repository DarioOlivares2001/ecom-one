import "dotenv/config";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import sharp from "sharp";

dotenv.config({ path: ".env.local", override: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "products";
const TARGET_MAX_BYTES = 400 * 1024;
const TARGET_WIDTH = 1200;
const WEBP_QUALITY = 82;
const DRY_RUN = process.argv.includes("--dry-run");

const missingEnvVars = [
  !SUPABASE_URL ? "NEXT_PUBLIC_SUPABASE_URL" : null,
  !SUPABASE_SERVICE_ROLE_KEY ? "SUPABASE_SERVICE_ROLE_KEY" : null,
].filter(Boolean);

if (missingEnvVars.length > 0) {
  console.error(`[optimize-product-images] Faltan variables: ${missingEnvVars.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function reductionPercent(before, after) {
  if (!before || before <= 0) return 0;
  return Math.max(0, Math.round(((before - after) / before) * 100));
}

function extractStoragePathFromUrl(url) {
  // Espera formato: .../storage/v1/object/public/products/<path>
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

function buildOptimizedPath(originalPath) {
  const lastSlash = originalPath.lastIndexOf("/");
  const dir = lastSlash >= 0 ? originalPath.slice(0, lastSlash + 1) : "";
  const filename = lastSlash >= 0 ? originalPath.slice(lastSlash + 1) : originalPath;
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  return `${dir}${base}-opt.webp`;
}

async function optimizeImageBuffer(buffer) {
  let quality = WEBP_QUALITY;
  let output = await sharp(buffer)
    .rotate()
    .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  while (output.length > TARGET_MAX_BYTES && quality > 55) {
    quality -= 6;
    output = await sharp(buffer)
      .rotate()
      .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
  }

  return output;
}

async function main() {
  const { data: products, error } = await supabase
    .from("products")
    .select("id,name,images")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[optimize-product-images] Error leyendo productos:", error.message);
    process.exit(1);
  }

  let processedImages = 0;
  let updatedProducts = 0;
  let totalOriginalBytes = 0;
  let totalOptimizedBytes = 0;

  for (const product of products ?? []) {
    const images = Array.isArray(product.images) ? product.images : [];
    if (images.length === 0) continue;

    const newImages = [];
    let productChanged = false;

    for (const url of images) {
      const storagePath = extractStoragePathFromUrl(url);
      if (!storagePath) {
        console.warn(`[optimize-product-images] URL fuera de bucket esperado, se mantiene: ${url}`);
        newImages.push(url);
        continue;
      }

      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.error(`[optimize-product-images] Error descargando ${url}: HTTP ${res.status}`);
          newImages.push(url);
          continue;
        }

        const arr = await res.arrayBuffer();
        const originalBuffer = Buffer.from(arr);
        const originalBytes = originalBuffer.length;

        const optimizedBuffer = await optimizeImageBuffer(originalBuffer);
        const optimizedBytes = optimizedBuffer.length;
        totalOriginalBytes += originalBytes;
        totalOptimizedBytes += optimizedBytes;

        const optimizedPath = buildOptimizedPath(storagePath);
        if (DRY_RUN) {
          processedImages += 1;
          console.log(
            `[optimize-product-images][dry-run] ${product.name} | ${storagePath} -> ${optimizedPath} | ${formatBytes(originalBytes)} -> ${formatBytes(optimizedBytes)} | -${reductionPercent(originalBytes, optimizedBytes)}%`
          );
          newImages.push(url);
          continue;
        }

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(optimizedPath, optimizedBuffer, {
            contentType: "image/webp",
            upsert: true,
          });

        if (uploadError) {
          console.error(`[optimize-product-images] Error subiendo ${optimizedPath}: ${uploadError.message}`);
          newImages.push(url);
          continue;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path);

        newImages.push(publicUrl);
        productChanged = true;
        processedImages += 1;

        console.log(
          `[optimize-product-images] ${product.name} | ${storagePath} -> ${optimizedPath} | ${formatBytes(originalBytes)} -> ${formatBytes(optimizedBytes)} | -${reductionPercent(originalBytes, optimizedBytes)}%`
        );
      } catch (err) {
        console.error(
          `[optimize-product-images] Error procesando ${url}:`,
          err instanceof Error ? err.message : err
        );
        newImages.push(url);
      }
    }

    if (productChanged) {
      if (DRY_RUN) {
        continue;
      }
      const { error: updateError } = await supabase
        .from("products")
        .update({ images: newImages })
        .eq("id", product.id);

      if (updateError) {
        console.error(
          `[optimize-product-images] Error actualizando DB producto ${product.id}: ${updateError.message}`
        );
      } else {
        updatedProducts += 1;
      }
    }
  }

  console.log("\n=== Resumen optimización ===");
  if (DRY_RUN) {
    console.log("Modo: DRY RUN (sin subir a Supabase ni actualizar DB)");
  } else {
    console.log("Modo: REAL (subida a Supabase + update DB)");
  }
  console.log(`Imágenes optimizadas/subidas: ${processedImages}`);
  console.log(`Productos actualizados en DB: ${updatedProducts}`);
  const estimatedSaved = Math.max(0, totalOriginalBytes - totalOptimizedBytes);
  const estimatedReduction = reductionPercent(totalOriginalBytes, totalOptimizedBytes);
  console.log(`Ahorro estimado total: ${formatBytes(estimatedSaved)} (-${estimatedReduction}%)`);
  if (!DRY_RUN) {
    console.log("Originales conservadas en bucket (no eliminadas).");
  }
}

main().catch((err) => {
  console.error("[optimize-product-images] Error inesperado:", err);
  process.exit(1);
});

