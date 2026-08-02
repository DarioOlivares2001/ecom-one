import "dotenv/config";
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

dotenv.config({ path: ".env.local", override: true });

const DRY_RUN =
  process.argv.includes("--dry-run") || String(process.env.npm_config_dry_run) === "true";

const missingEnvVars = [
  !process.env.DATABASE_URL ? "DATABASE_URL" : null,
  !process.env.R2_ACCOUNT_ID ? "R2_ACCOUNT_ID" : null,
  !process.env.R2_ACCESS_KEY_ID ? "R2_ACCESS_KEY_ID" : null,
  !process.env.R2_SECRET_ACCESS_KEY ? "R2_SECRET_ACCESS_KEY" : null,
  !process.env.R2_BUCKET_NAME ? "R2_BUCKET_NAME" : null,
  !process.env.R2_PUBLIC_URL ? "R2_PUBLIC_URL" : null,
].filter(Boolean);

if (missingEnvVars.length > 0) {
  console.error(`[fix-product-image-urls] Faltan variables: ${missingEnvVars.join(", ")}`);
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
  const raw = String(url ?? "");
  if (!raw.startsWith(`${R2_PUBLIC_URL}/`)) return null;
  return decodeURIComponent(raw.slice(R2_PUBLIC_URL.length + 1));
}

function buildPublicUrl(key) {
  return `${R2_PUBLIC_URL}/${key}`;
}

function toOptimizedKey(key) {
  if (!key) return null;
  if (/-opt\.webp$/i.test(key)) return key;
  if (!/\.(png|jpe?g|webp)$/i.test(key)) return null;
  return key.replace(/\.[^.]+$/i, "-opt.webp");
}

async function keyExists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function fixProductsImages() {
  const products = await sql`select id, name, images from products order by created_at desc`;

  let reviewed = 0;
  let changed = 0;

  for (const product of products ?? []) {
    const images = Array.isArray(product.images) ? product.images : [];
    if (!images.length) continue;

    const nextImages = [];
    let changedThis = false;

    for (const url of images) {
      reviewed += 1;
      const key = extractR2KeyFromUrl(url);
      if (!key) {
        nextImages.push(url);
        continue;
      }

      const optimizedKey = toOptimizedKey(key);
      if (!optimizedKey || optimizedKey === key) {
        nextImages.push(url);
        continue;
      }

      const optimizedExists = await keyExists(optimizedKey);
      if (!optimizedExists) {
        console.log(`[fix-product-image-urls] omitida (sin -opt): ${url}`);
        nextImages.push(url);
        continue;
      }

      const optimizedUrl = buildPublicUrl(optimizedKey);
      console.log(
        `[fix-product-image-urls] products.images | ${product.name}\n  before: ${url}\n  after:  ${optimizedUrl}`
      );
      nextImages.push(optimizedUrl);
      changedThis = true;
    }

    if (changedThis) {
      changed += 1;
      if (!DRY_RUN) {
        try {
          await sql`update products set images = ${nextImages} where id = ${product.id}`;
        } catch (updateError) {
          console.error(`[fix-product-image-urls] Error actualizando products ${product.id}:`, updateError);
        }
      }
    }
  }

  return { reviewed, changed };
}

async function fixVariantImages() {
  const variants = await sql`select id, product_id, title, image_url from product_variants`;

  let reviewed = 0;
  let changed = 0;

  for (const variant of variants ?? []) {
    const url = variant.image_url;
    if (!url) continue;
    reviewed += 1;

    const key = extractR2KeyFromUrl(url);
    if (!key) continue;

    const optimizedKey = toOptimizedKey(key);
    if (!optimizedKey || optimizedKey === key) continue;

    const optimizedExists = await keyExists(optimizedKey);
    if (!optimizedExists) {
      console.log(`[fix-product-image-urls] omitida variante (sin -opt): ${url}`);
      continue;
    }

    const optimizedUrl = buildPublicUrl(optimizedKey);
    console.log(
      `[fix-product-image-urls] product_variants.image_url | ${variant.title}\n  before: ${url}\n  after:  ${optimizedUrl}`
    );
    changed += 1;

    if (!DRY_RUN) {
      try {
        await sql`update product_variants set image_url = ${optimizedUrl} where id = ${variant.id}`;
      } catch (updateError) {
        console.error(`[fix-product-image-urls] Error actualizando variante ${variant.id}:`, updateError);
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
