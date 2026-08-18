/**
 * Mismo algoritmo que ya usan `app/admin/productos/nuevo/page.tsx` y
 * `EditProductoForm.tsx` para el campo slug — duplicado acá a propósito
 * (no se toca esos archivos) para que el estudio (demo o IA real) derive el
 * slug del nombre exactamente igual que lo haría un admin escribiéndolo a mano.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}
