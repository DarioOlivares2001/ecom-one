import { isAllowedImageSrc } from "@/lib/images/isAllowedImageSrc";

export type ParseImagesResult =
  | { ok: true; images: string[] }
  | { ok: false; error: string };

/**
 * Lee un campo de imágenes (`images_json` para la galería pública,
 * `product_media_json` para la biblioteca de medios) de un FormData enviado
 * por el admin: un array de URLs ya subidas a R2 por `ProductMediaLibrary`
 * (el upload ocurre al elegir el archivo, no al guardar el producto — ver
 * `/api/upload/product-image`). Valida cada URL contra el host público de R2
 * configurado para que nadie pueda inyectar una URL arbitraria manipulando
 * el request.
 */
export function parseImagesFromFormData(
  formData: FormData,
  field: string = "images_json"
): ParseImagesResult {
  const raw = formData.get(field);

  if (raw == null || (typeof raw === "string" && raw.trim() === "")) {
    return { ok: true, images: [] };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: `${field} debe ser un string JSON.` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: `${field} no es un JSON válido.` };
  }

  if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === "string")) {
    return { ok: false, error: `${field} debe ser un array de URLs.` };
  }

  const invalid = parsed.find((url) => !isAllowedImageSrc(url));
  if (invalid) {
    return { ok: false, error: `URL de imagen no permitida: ${invalid}` };
  }

  return { ok: true, images: parsed };
}
