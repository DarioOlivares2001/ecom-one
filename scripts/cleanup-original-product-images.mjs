import "dotenv/config";
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import { DeleteObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

dotenv.config({ path: ".env.local", override: true });

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
  console.error(`[cleanup-original-images] Faltan variables: ${missingEnvVars.join(", ")}`);
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

function extractR2KeyFromUrl(url) {
  if (!url.startsWith(`${R2_PUBLIC_URL}/`)) return null;
  return decodeURIComponent(url.slice(R2_PUBLIC_URL.length + 1));
}

function isOptimizedKey(key) {
  return /-opt\.webp$/i.test(key);
}

function buildPublicUrl(key) {
  return `${R2_PUBLIC_URL}/${key}`;
}

async function keyExists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const products = await sql`select id, name, images from products order by created_at desc`;

  const usedUrls = new Set();
  for (const p of products ?? []) {
    for (const url of Array.isArray(p.images) ? p.images : []) {
      usedUrls.add(url);
    }
  }

  const candidateOriginalKeys = new Set();
  for (const usedUrl of usedUrls) {
    const key = extractR2KeyFromUrl(usedUrl);
    if (!key || !isOptimizedKey(key)) continue;
    const originalBase = key.replace(/-opt\.webp$/i, "");
    for (const ext of ["png", "jpg", "jpeg", "webp"]) {
      candidateOriginalKeys.add(`${originalBase}.${ext}`);
    }
  }

  let deleted = 0;
  let skipped = 0;

  for (const originalKey of candidateOriginalKeys) {
    if (isOptimizedKey(originalKey)) {
      skipped += 1;
      console.log(`[cleanup-original-images] imagen omitida: ${originalKey} (ya optimizada)`);
      continue;
    }

    const optimizedKey = originalKey.replace(/\.[^.]+$/, "-opt.webp");
    const originalUrl = buildPublicUrl(originalKey);
    const optimizedUrl = buildPublicUrl(optimizedKey);

    if (usedUrls.has(originalUrl)) {
      skipped += 1;
      console.log(`[cleanup-original-images] imagen omitida: ${originalKey} (aún en products.images)`);
      continue;
    }

    if (!usedUrls.has(optimizedUrl)) {
      skipped += 1;
      console.log(
        `[cleanup-original-images] imagen omitida: ${originalKey} (versión optimizada no usada en DB)`
      );
      continue;
    }

    const optimizedExists = await keyExists(optimizedKey);
    if (!optimizedExists) {
      skipped += 1;
      console.log(`[cleanup-original-images] imagen omitida: ${originalKey} (no existe ${optimizedKey})`);
      continue;
    }

    const originalExists = await keyExists(originalKey);
    if (!originalExists) {
      skipped += 1;
      console.log(`[cleanup-original-images] imagen omitida: ${originalKey} (original no existe en bucket)`);
      continue;
    }

    if (DRY_RUN) {
      deleted += 1;
      console.log(`[cleanup-original-images][dry-run] imagen eliminada: ${originalKey}`);
      continue;
    }

    try {
      await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: originalKey }));
      deleted += 1;
      console.log(`[cleanup-original-images] imagen eliminada: ${originalKey}`);
    } catch (removeError) {
      skipped += 1;
      console.log(`[cleanup-original-images] imagen omitida: ${originalKey} (error delete: ${removeError})`);
    }
  }

  console.log("\n=== Resumen limpieza originales ===");
  console.log(`Modo: ${DRY_RUN ? "DRY RUN (sin borrar)" : "REAL (borrado en bucket)"}`);
  console.log(`Imágenes eliminadas: ${deleted}`);
  console.log(`Imágenes omitidas: ${skipped}`);
}

main().catch((err) => {
  console.error("[cleanup-original-images] Error inesperado:", err);
  process.exit(1);
});
