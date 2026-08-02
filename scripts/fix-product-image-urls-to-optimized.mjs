import "dotenv/config";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", override: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "products";
const DRY_RUN =
  process.argv.includes("--dry-run") || String(process.env.npm_config_dry_run) === "true";

const missingEnvVars = [
  !SUPABASE_URL ? "NEXT_PUBLIC_SUPABASE_URL" : null,
  !SUPABASE_SERVICE_ROLE_KEY ? "SUPABASE_SERVICE_ROLE_KEY" : null,
].filter(Boolean);

if (missingEnvVars.length > 0) {
  console.error(`[fix-product-image-urls] Faltan variables: ${missingEnvVars.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function extractStoragePathFromUrl(url) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = String(url ?? "").indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(String(url).slice(idx + marker.length));
}

function buildPublicUrl(path) {
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return publicUrl;
}

function toOptimizedPath(path) {
  if (!path) return null;
  if (/[-]opt\.webp$/i.test(path)) return path;
  if (!/\.(png|jpe?g|webp)$/i.test(path)) return null;
  return path.replace(/\.[^.]+$/i, "-opt.webp");
}

async function pathExists(path) {
  const { error } = await supabase.storage.from(BUCKET).download(path);
  return !error;
}

async function fixProductsImages() {
  const { data: products, error } = await supabase
    .from("products")
    .select("id,name,images")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[fix-product-image-urls] Error leyendo products:", error.message);
    process.exit(1);
  }

  let reviewed = 0;
  let changed = 0;

  for (const product of products ?? []) {
    const images = Array.isArray(product.images) ? product.images : [];
    if (!images.length) continue;

    const nextImages = [];
    let changedThis = false;

    for (const url of images) {
      reviewed += 1;
      const storagePath = extractStoragePathFromUrl(url);
      if (!storagePath) {
        nextImages.push(url);
        continue;
      }

      const optimizedPath = toOptimizedPath(storagePath);
      if (!optimizedPath || optimizedPath === storagePath) {
        nextImages.push(url);
        continue;
      }

      const optimizedExists = await pathExists(optimizedPath);
      if (!optimizedExists) {
        console.log(`[fix-product-image-urls] omitida (sin -opt): ${url}`);
        nextImages.push(url);
        continue;
      }

      const optimizedUrl = buildPublicUrl(optimizedPath);
      console.log(
        `[fix-product-image-urls] products.images | ${product.name}\n  before: ${url}\n  after:  ${optimizedUrl}`
      );
      nextImages.push(optimizedUrl);
      changedThis = true;
    }

    if (changedThis) {
      changed += 1;
      if (!DRY_RUN) {
        const { error: updateError } = await supabase
          .from("products")
          .update({ images: nextImages })
          .eq("id", product.id);
        if (updateError) {
          console.error(
            `[fix-product-image-urls] Error actualizando products ${product.id}: ${updateError.message}`
          );
        }
      }
    }
  }

  return { reviewed, changed };
}

async function fixVariantImages() {
  const { data: variants, error } = await supabase
    .from("product_variants")
    .select("id,product_id,title,image_url");

  if (error) {
    console.error("[fix-product-image-urls] Error leyendo product_variants:", error.message);
    process.exit(1);
  }

  let reviewed = 0;
  let changed = 0;

  for (const variant of variants ?? []) {
    const url = variant.image_url;
    if (!url) continue;
    reviewed += 1;

    const storagePath = extractStoragePathFromUrl(url);
    if (!storagePath) continue;

    const optimizedPath = toOptimizedPath(storagePath);
    if (!optimizedPath || optimizedPath === storagePath) continue;

    const optimizedExists = await pathExists(optimizedPath);
    if (!optimizedExists) {
      console.log(`[fix-product-image-urls] omitida variante (sin -opt): ${url}`);
      continue;
    }

    const optimizedUrl = buildPublicUrl(optimizedPath);
    console.log(
      `[fix-product-image-urls] product_variants.image_url | ${variant.title}\n  before: ${url}\n  after:  ${optimizedUrl}`
    );
    changed += 1;

    if (!DRY_RUN) {
      const { error: updateError } = await supabase
        .from("product_variants")
        .update({ image_url: optimizedUrl })
        .eq("id", variant.id);
      if (updateError) {
        console.error(
          `[fix-product-image-urls] Error actualizando variante ${variant.id}: ${updateError.message}`
        );
      }
    }
  }

  return { reviewed, changed };
}

async function main() {
  const productsResult = await fixProductsImages();
  const variantsResult = await fixVariantImages();

  console.log("\n=== Resumen fix URLs ===");
  console.log(`Modo: ${DRY_RUN ? "DRY RUN (sin escribir DB)" : "REAL (actualiza DB)"}`);
  console.log(
    `products.images revisadas: ${productsResult.reviewed} | productos con cambios: ${productsResult.changed}`
  );
  console.log(
    `product_variants.image_url revisadas: ${variantsResult.reviewed} | variantes con cambios: ${variantsResult.changed}`
  );
}

main().catch((err) => {
  console.error("[fix-product-image-urls] Error inesperado:", err);
  process.exit(1);
});

