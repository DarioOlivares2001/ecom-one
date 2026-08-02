import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 (API compatible con S3). Solo servidor — nunca importar desde
 * un componente cliente. Las credenciales son privadas (sin prefijo
 * NEXT_PUBLIC_*); solo R2_PUBLIC_URL se expone (es la URL pública del bucket).
 * Ver R2_SETUP.md para cómo crear el bucket y el token de acceso.
 */

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  const publicUrlRaw = process.env.R2_PUBLIC_URL?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrlRaw) {
    throw new Error(
      "Faltan variables de Cloudflare R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL) en .env.local. Ver R2_SETUP.md."
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl: publicUrlRaw.replace(/\/+$/, "") };
}

/** true si las 5 variables R2_* están configuradas (para mostrar mensajes claros antes de intentar subir). */
export function isR2Configured(): boolean {
  try {
    getR2Config();
    return true;
  } catch {
    return false;
  }
}

let cachedClient: S3Client | null = null;

function getR2Client(config: R2Config): S3Client {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return cachedClient;
}

export interface UploadToR2Options {
  /** Ruta dentro del bucket, ej. "products/1712345-0.webp" (sin slash inicial). */
  key: string;
  body: Buffer;
  contentType: string;
  /** Default: cacheable a largo plazo — todos los nombres de archivo son únicos (timestamp). */
  cacheControl?: string;
}

/** Sube un objeto a R2 y devuelve su URL pública persistente. */
export async function uploadToR2({
  key,
  body,
  contentType,
  cacheControl = "public, max-age=31536000, immutable",
}: UploadToR2Options): Promise<string> {
  const config = getR2Config();
  const client = getR2Client(config);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    })
  );

  return `${config.publicUrl}/${key}`;
}

/** Elimina un objeto de R2 por su key (ruta relativa dentro del bucket). */
export async function deleteFromR2(key: string): Promise<void> {
  const config = getR2Config();
  const client = getR2Client(config);
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}

/** Extrae la key R2 desde una URL pública completa (para borrado seguro). null si no pertenece a este bucket. */
export function extractR2KeyFromPublicUrl(url: string): string | null {
  try {
    const { publicUrl } = getR2Config();
    if (!url.startsWith(`${publicUrl}/`)) return null;
    return url.slice(publicUrl.length + 1);
  } catch {
    return null;
  }
}

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function isAllowedImageMimeType(mimeType: string): boolean {
  return ALLOWED_IMAGE_MIME_TYPES.has(mimeType);
}

/** Límite defensivo de tamaño de archivo ANTES de comprimir (10 MB). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
