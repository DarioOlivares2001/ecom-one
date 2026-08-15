import { isAllowedImageSrc } from "@/lib/images/isAllowedImageSrc";

export type ParseImagesResult =
  | { ok: true; images: string[] }
  | { ok: false; error: string };

/**
 * Lee `images_json` de un FormData enviado por el admin: un array de URLs ya
 * subidas a R2 por `ProductMediaLibrary` (el upload ocurre al elegir el
 * archivo, no al guardar el producto — ver `/api/upload/product-image`).
 * Valida cada URL contra el host público de R2 configurado para que nadie
 * pueda inyectar una URL arbitraria manipulando el request.
 */
export function parseImagesFromFormData(formData: FormData): ParseImagesResult {
  const raw = formData.get("images_json");

  if (raw == null || (typeof raw === "string" && raw.trim() === "")) {
    return { ok: true, images: [] };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "images_json debe ser un string JSON." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "images_json no es un JSON válido." };
  }

  if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === "string")) {
    return { ok: false, error: "images_json debe ser un array de URLs." };
  }

  const invalid = parsed.find((url) => !isAllowedImageSrc(url));
  if (invalid) {
    return { ok: false, error: `URL de imagen no permitida: ${invalid}` };
  }

  return { ok: true, images: parsed };
}
