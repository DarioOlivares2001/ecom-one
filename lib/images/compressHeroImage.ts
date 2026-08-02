import sharp from "sharp";

export type HeroBannerKind = "desktop" | "mobile";

export type CompressHeroImageResult = {
  buffer: Buffer;
  mimeType: "image/webp";
  bytes: number;
  originalBytes: number;
  qualityUsed: number;
};

const DESKTOP_MAX_WIDTH = 1600;
const MOBILE_MAX_WIDTH = 900;
const DESKTOP_MAX_BYTES = 400 * 1024;
const MOBILE_MAX_BYTES = 300 * 1024;
const QUALITY_MIN = 70;
const QUALITY_START = 82;

function maxBytesForKind(kind: HeroBannerKind): number {
  return kind === "desktop" ? DESKTOP_MAX_BYTES : MOBILE_MAX_BYTES;
}

function maxWidthForKind(kind: HeroBannerKind): number {
  return kind === "desktop" ? DESKTOP_MAX_WIDTH : MOBILE_MAX_WIDTH;
}

async function encodeWebp(
  input: Buffer,
  kind: HeroBannerKind,
  quality: number
): Promise<Buffer> {
  const maxWidth = maxWidthForKind(kind);
  return sharp(input)
    .rotate()
    .resize({
      width: maxWidth,
      withoutEnlargement: true,
      fit: "inside",
    })
    .webp({ quality, effort: 4 })
    .toBuffer();
}

/**
 * Optimiza un banner hero: WebP, resize por tipo, calidad 82→70 si supera el límite de peso.
 */
export async function compressHeroImage(
  input: Buffer,
  kind: HeroBannerKind
): Promise<CompressHeroImageResult> {
  const originalBytes = input.length;
  const maxBytes = maxBytesForKind(kind);

  let quality = QUALITY_START;
  let buffer = await encodeWebp(input, kind, quality);

  while (buffer.length > maxBytes && quality > QUALITY_MIN) {
    quality -= 2;
    buffer = await encodeWebp(input, kind, quality);
  }

  if (buffer.length > maxBytes && quality <= QUALITY_MIN) {
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
