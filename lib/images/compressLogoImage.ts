import sharp from "sharp";

export type LogoKind = "horizontal" | "square";

export type CompressLogoImageResult = {
  buffer: Buffer;
  mimeType: "image/webp";
  bytes: number;
  originalBytes: number;
  qualityUsed: number;
};

// El logo horizontal solo limita ancho (alto libre, según el aspect ratio real
// del wordmark); el cuadrado se fuerza a un lienzo N x N con "contain" +
// transparencia, igual criterio que compressIconImage, para no recortar el logo.
const HORIZONTAL_MAX_WIDTH = 600;
const SQUARE_SIZE = 512;
const MAX_BYTES = 250 * 1024;
const QUALITY_MIN = 70;
const QUALITY_START = 82;

async function encodeWebp(input: Buffer, kind: LogoKind, quality: number): Promise<Buffer> {
  const base = sharp(input).rotate();
  const resized =
    kind === "horizontal"
      ? base.resize({ width: HORIZONTAL_MAX_WIDTH, withoutEnlargement: true, fit: "inside" })
      : base.resize(SQUARE_SIZE, SQUARE_SIZE, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        });
  return resized.webp({ quality, effort: 4 }).toBuffer();
}

/**
 * Optimiza un logo: WebP (conserva transparencia), resize según horizontal/cuadrado,
 * calidad 82→70 si supera el límite de peso. Mismo esquema que compressHeroImage.
 */
export async function compressLogoImage(input: Buffer, kind: LogoKind): Promise<CompressLogoImageResult> {
  const originalBytes = input.length;

  let quality = QUALITY_START;
  let buffer = await encodeWebp(input, kind, quality);

  while (buffer.length > MAX_BYTES && quality > QUALITY_MIN) {
    quality -= 2;
    buffer = await encodeWebp(input, kind, quality);
  }

  if (buffer.length > MAX_BYTES && quality <= QUALITY_MIN) {
    buffer = await encodeWebp(input, kind, QUALITY_MIN);
  }

  return {
    buffer,
    mimeType: "image/webp",
    bytes: buffer.length,
    originalBytes,
    qualityUsed: quality,
  };
}
