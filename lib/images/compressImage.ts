import imageCompression from "browser-image-compression";

const MAX_SIZE_BYTES = 400 * 1024;
const MAX_WIDTH = 1200;
const QUALITY = 0.82;

export type CompressionResult = {
  file: File;
  originalSize: number;
  compressedSize: number;
  reducedPercent: number;
  compressed: boolean;
};

function asPercent(before: number, after: number) {
  if (before <= 0) return 0;
  return Math.max(0, Math.round(((before - after) / before) * 100));
}

export async function compressImageIfNeeded(file: File): Promise<CompressionResult> {
  const originalSize = file.size;
  const baseOptions = {
    maxSizeMB: MAX_SIZE_BYTES / (1024 * 1024),
    maxWidthOrHeight: MAX_WIDTH,
    initialQuality: QUALITY,
    useWebWorker: true,
  };

  try {
    const webpBlob = await imageCompression(file, {
      ...baseOptions,
      fileType: "image/webp",
    });
    const webpFile = new File([webpBlob], file.name.replace(/\.[^.]+$/, ".webp"), {
      type: "image/webp",
      lastModified: Date.now(),
    });
    const changed = webpFile.size !== originalSize || webpFile.type !== file.type;
    return {
      file: webpFile,
      originalSize,
      compressedSize: webpFile.size,
      reducedPercent: asPercent(originalSize, webpFile.size),
      compressed: changed,
    };
  } catch {
    const fallbackBlob = await imageCompression(file, baseOptions);
    const fallbackFile = new File([fallbackBlob], file.name, {
      type: fallbackBlob.type || file.type,
      lastModified: Date.now(),
    });
    const changed = fallbackFile.size !== originalSize || fallbackFile.type !== file.type;
    return {
      file: fallbackFile,
      originalSize,
      compressedSize: fallbackFile.size,
      reducedPercent: asPercent(originalSize, fallbackFile.size),
      compressed: changed,
    };
  }
}

