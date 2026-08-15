/**
 * Sube una imagen a la biblioteca de medios del producto (mismo bucket R2 que
 * el resto del admin) y devuelve su URL pública. Lanza si falla — el caller
 * decide cómo mostrar el error. Usado tanto por la galería principal como,
 * indirectamente, por los bloques modulares (que reutilizan esas mismas URLs
 * en vez de subir archivos propios).
 */
export async function uploadProductImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload/product-image", {
    method: "POST",
    body: fd,
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    throw new Error(data.error ?? "Error al subir la imagen.");
  }
  return data.url;
}
