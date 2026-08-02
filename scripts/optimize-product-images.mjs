import "dotenv/config";
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fetch from "node-fetch";
import sharp from "sharp";

dotenv.config({ path: ".env.local", override: true });

const TARGET_MAX_BYTES = 400 * 1024;
const TARGET_WIDTH = 1200;
const WEBP_QUALITY = 82;
const DRY_RUN = process.argv.includes("--dry-run");

const missingEnvVars = [
  !process.env.DATABASE_URL ? "DATABASE_URL" : null,
  !process.env.R2_ACCOUNT_ID ? "R2_ACCOUNT_ID" : null,
  !process.env.R2_ACCESS_KEY_ID ? "R2_ACCESS_KEY_ID" : null,
  !process.env.R2_SECRET_ACCESS_KEY ? "R2_SECRET_ACCESS_KEY" : null,
  !process.env.R2_BUCKET_NAME ? "R2_BUCKET_NAME" : null,
  !process.env.R2_PUBLIC_URL ? "R2_PUBLIC_URL" : null,
].filter(Boolean);

if (missingEnvVars.length > 0) {
  console.error(`[optimize-product-images] Faltan variables: ${missingEnvVars.join(", ")}`);
  console.error("Ver R2_SETUP.md para configurar Cloudflare R2.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const R2_BUCKET = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL.replace(/\/+$/, "");
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

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

/** Extrae la key R2 de una URL pública. Solo procesa imágenes ya alojadas en el bucket configurado. */
function extractR2KeyFromUrl(url) {
  if (!url.startsWith(`${R2_PUBLIC_URL}/`)) return null;
  return decodeURIComponent(url.slice(R2_PUBLIC_URL.length + 1));
}

function buildOptimizedKey(originalKey) {
  const lastSlash = originalKey.lastIndexOf("/");
  const dir = lastSlash >= 0 ? originalKey.slice(0, lastSlash + 1) : "";
  const filename = lastSlash >= 0 ? originalKey.slice(lastSlash + 1) : originalKey;
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

async function uploadToR2(key, body, contentType) {
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return `${R2_PUBLIC_URL}/${key}`;
}

async function main() {
  const products = await sql`select id, name, images from products order by created_at desc`;

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
      const key = extractR2KeyFromUrl(url);
      if (!key) {
        console.warn(`[optimize-product-images] URL fuera del bucket R2 configurado, se mantiene: ${url}`);
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

        const optimizedKey = buildOptimizedKey(key);
        if (DRY_RUN) {
          processedImages += 1;
          console.log(
            `[optimize-product-images][dry-run] ${product.name} | ${key} -> ${optimizedKey} | ${formatBytes(originalBytes)} -> ${formatBytes(optimizedBytes)} | -${reductionPercent(originalBytes, optimizedBytes)}%`
          );
          newImages.push(url);
          continue;
        }

        const publicUrl = await uploadToR2(optimizedKey, optimizedBuffer, "image/webp");
        newImages.push(publicUrl);
        productChanged = true;
        processedImages += 1;

        console.log(
          `[optimize-product-images] ${product.name} | ${key} -> ${optimizedKey} | ${formatBytes(originalBytes)} -> ${formatBytes(optimizedBytes)} | -${reductionPercent(originalBytes, optimizedBytes)}%`
        );
      } catch (err) {
        console.error(
          `[optimize-product-images] Error procesando ${url}:`,
          err instanceof Error ? err.message : err
        );
        newImages.push(url);
      }
    }

    if (productChanged && !DRY_RUN) {
      try {
        await sql`update products set images = ${newImages} where id = ${product.id}`;
        updatedProducts += 1;
      } catch (updateError) {
        console.error(`[optimize-product-images] Error actualizando DB producto ${product.id}:`, updateError);
      }
    }
  }

  console.log("\n=== Resumen optimización ===");
  console.log(DRY_RUN ? "Modo: DRY RUN (sin subir a R2 ni actualizar DB)" : "Modo: REAL (subida a R2 + update DB)");
  console.log(`Imágenes optimizadas/subidas: ${processedImages}`);
  console.log(`Productos actualizados en DB: ${updatedProducts}`);
  const estimatedSaved = Math.max(0, totalOriginalBytes - totalOptimizedBytes);
  const estimatedReduction = reductionPercent(totalOriginalBytes, totalOptimizedBytes);
  console.log(`Ahorro estimado total: ${formatBytes(estimatedSaved)} (-${estimatedReduction}%)`);
  if (!DRY_RUN) {
    console.log("Originales conservadas en el bucket (no eliminadas).");
  }
}

main().catch((err) => {
  console.error("[optimize-product-images] Error inesperado:", err);
  process.exit(1);
});
