import "server-only";

import { MAX_UPLOAD_BYTES, uploadToR2 } from "@/lib/storage/r2";
import type { ApprovedAIImage } from "./types";

/**
 * Prefijo dedicado — nunca se mezclan imágenes generadas por IA con
 * `products/<archivo>` (fotos subidas a mano). Mismo bucket, carpeta
 * separada: fácil de auditar/filtrar, y `extractR2KeyFromPublicUrl` +
 * chequeo de prefijo (patrón ya usado en `app/api/upload/product-image`)
 * sigue funcionando igual para cualquier borrado futuro.
 */
export const AI_GENERATED_IMAGE_PREFIX = "products/ai-generated/";

const MAX_METADATA_VALUE_LENGTH = 400;

/**
 * Los headers de metadata de S3/R2 solo soportan ASCII — el prompt (u otro
 * texto libre) casi siempre trae tildes/ñ/emoji, así que se codifica con
 * `encodeURIComponent` antes de guardarlo (reversible con `decodeURIComponent`
 * al leerlo) y se recorta a un largo razonable para no exceder límites de
 * headers HTTP.
 */
export function toAsciiMetadataValue(raw: string, maxLength = MAX_METADATA_VALUE_LENGTH): string {
  const encoded = encodeURIComponent(raw.trim());
  return encoded.length > maxLength ? encoded.slice(0, maxLength) : encoded;
}

export interface UploadApprovedAIImageInput {
  /** Imagen ya generada por OpenAI (`generateProductImage`), en base64 crudo (sin el prefijo "data:..."). */
  base64: string;
  mimeType: string;
  sectionId: string;
  sectionType: string;
  prompt: string;
  referenceImageUrl: string;
}

export function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "jpg";
  return "png";
}

/**
 * Sube a R2 una imagen generada por IA YA APROBADA explícitamente por el
 * admin — nunca se llama antes de esa aprobación (ver
 * `app/api/admin/ai-product-studio/approve-image/route.ts`). Metadata
 * interna del objeto (origin=ai_generated, sección destino, prompt, fecha):
 * nunca aparece en la URL pública ni en ningún dato que llegue al
 * storefront, solo es legible vía la API de R2/S3.
 *
 * `producto_id` NO se incluye acá a propósito: en este punto del asistente
 * el producto todavía no existe (el Estudio IA solo arma un borrador; recién
 * se crea al guardar en `/admin/productos/nuevo`) — no hay un id real que
 * asociar todavía.
 */
export async function uploadApprovedAIImage(input: UploadApprovedAIImageInput): Promise<ApprovedAIImage> {
  const buffer = Buffer.from(input.base64, "base64");
  if (buffer.byteLength === 0) {
    throw new Error("La imagen aprobada llegó vacía.");
  }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("La imagen generada supera el tamaño máximo permitido.");
  }

  const createdAt = new Date().toISOString();
  const key = `${AI_GENERATED_IMAGE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionForMimeType(input.mimeType)}`;

  const url = await uploadToR2({
    key,
    body: buffer,
    contentType: input.mimeType,
    metadata: {
      origin: "ai_generated",
      "section-id": toAsciiMetadataValue(input.sectionId, 128),
      "section-type": toAsciiMetadataValue(input.sectionType, 64),
      prompt: toAsciiMetadataValue(input.prompt),
      "reference-image-url": toAsciiMetadataValue(input.referenceImageUrl, 512),
      "created-at": createdAt,
    },
  });

  return {
    url,
    sectionId: input.sectionId,
    sectionType: input.sectionType,
    prompt: input.prompt,
    referenceImageUrl: input.referenceImageUrl,
    createdAt,
  };
}
