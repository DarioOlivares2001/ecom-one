/**
 * Estilos compartidos para inputs/textareas/labels de los editores de bloques
 * modulares. Coincide con el resto del admin (border, focus ring, etc.).
 */
export const inputCls =
  "h-9 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]";

export const textareaCls =
  "w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]";

export const labelCls = "text-xs font-semibold text-zinc-600";

/**
 * Sube una imagen de bloque modular (secuencia visual, comparador
 * antes/después) al mismo bucket R2 que el resto del admin y devuelve su URL
 * pública. Lanza si falla — el caller decide cómo mostrar el error.
 */
export async function uploadProductSectionImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload/product-section-image", {
    method: "POST",
    body: fd,
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    throw new Error(data.error ?? "Error al subir la imagen.");
  }
  return data.url;
}
