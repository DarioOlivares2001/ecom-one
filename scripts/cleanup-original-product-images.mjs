import "dotenv/config";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", override: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "products";
const DRY_RUN = process.argv.includes("--dry-run");

const missingEnvVars = [
  !SUPABASE_URL ? "NEXT_PUBLIC_SUPABASE_URL" : null,
  !SUPABASE_SERVICE_ROLE_KEY ? "SUPABASE_SERVICE_ROLE_KEY" : null,
].filter(Boolean);

if (missingEnvVars.length > 0) {
  console.error(`[cleanup-original-images] Faltan variables: ${missingEnvVars.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function extractStoragePathFromUrl(url) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

function isOptimizedPath(path) {
  return /-opt\.webp$/i.test(path);
}

function buildPublicUrl(path) {
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return publicUrl;
}

async function pathExists(path) {
  const { error } = await supabase.storage.from(BUCKET).download(path);
  return !error;
}

async function main() {
  const { data: products, error } = await supabase
    .from("products")
    .select("id,name,images")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[cleanup-original-images] Error leyendo productos:", error.message);
    process.exit(1);
  }

  const usedUrls = new Set();
  for (const p of products ?? []) {
    for (const url of Array.isArray(p.images) ? p.images : []) {
      usedUrls.add(url);
    }
  }

  const candidateOriginalPaths = new Set();
  for (const usedUrl of usedUrls) {
    const path = extractStoragePathFromUrl(usedUrl);
    if (!path || !isOptimizedPath(path)) continue;
    const originalBase = path.replace(/-opt\.webp$/i, "");
    for (const ext of ["png", "jpg", "jpeg", "webp"]) {
      candidateOriginalPaths.add(`${originalBase}.${ext}`);
    }
  }

  let deleted = 0;
  let skipped = 0;

  for (const originalPath of candidateOriginalPaths) {
    if (isOptimizedPath(originalPath)) {
      skipped += 1;
      console.log(`[cleanup-original-images] imagen omitida: ${originalPath} (ya optimizada)`);
      continue;
    }

    const optimizedPath = originalPath.replace(/\.[^.]+$/, "-opt.webp");
    const originalUrl = buildPublicUrl(originalPath);
    const optimizedUrl = buildPublicUrl(optimizedPath);

    if (usedUrls.has(originalUrl)) {
      skipped += 1;
      console.log(
        `[cleanup-original-images] imagen omitida: ${originalPath} (aún en products.images)`
      );
      continue;
    }

    if (!usedUrls.has(optimizedUrl)) {
      skipped += 1;
      console.log(
        `[cleanup-original-images] imagen omitida: ${originalPath} (versión optimizada no usada en DB)`
      );
      continue;
    }

    const optimizedExists = await pathExists(optimizedPath);
    if (!optimizedExists) {
      skipped += 1;
      console.log(
        `[cleanup-original-images] imagen omitida: ${originalPath} (no existe ${optimizedPath})`
      );
      continue;
    }

    const originalExists = await pathExists(originalPath);
    if (!originalExists) {
      skipped += 1;
      console.log(
        `[cleanup-original-images] imagen omitida: ${originalPath} (original no existe en bucket)`
      );
      continue;
    }

    if (DRY_RUN) {
      deleted += 1;
      console.log(`[cleanup-original-images][dry-run] imagen eliminada: ${originalPath}`);
      continue;
    }

    const { error: removeError } = await supabase.storage.from(BUCKET).remove([originalPath]);
    if (removeError) {
      skipped += 1;
      console.log(
        `[cleanup-original-images] imagen omitida: ${originalPath} (error delete: ${removeError.message})`
      );
      continue;
    }

    deleted += 1;
    console.log(`[cleanup-original-images] imagen eliminada: ${originalPath}`);
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

