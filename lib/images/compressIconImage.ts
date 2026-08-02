import sharp from "sharp";

export type CompressIconImageResult = {
  buffer: Buffer;
  mimeType: "image/png";
  bytes: number;
};

/**
 * Genera un ícono cuadrado PNG de `sizePx` desde cualquier imagen de origen.
 * `fit: "contain"` + fondo transparente: se ve el logo completo, sin recortar
 * nada, aunque la imagen original no sea cuadrada (se agregan márgenes
 * transparentes en vez de cortar bordes).
 */
export async function compressIconImage(input: Buffer, sizePx: number): Promise<CompressIconImageResult> {
  const buffer = await sharp(input)
    .rotate()
    .resize(sizePx, sizePx, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return { buffer, mimeType: "image/png", bytes: buffer.length };
}
