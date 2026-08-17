/**
 * Borra una imagen de la biblioteca de medios en R2 por su URL pública.
 * Nunca lanza — es una limpieza best-effort (ej. al cancelar el Estudio IA de
 * Producto antes de aplicar el borrador): un fallo acá no debe bloquear ni
 * alarmar al usuario, solo deja un objeto huérfano que se puede limpiar luego
 * a mano desde el bucket si hiciera falta.
 */
export async function deleteProductImage(url: string): Promise<boolean> {
  try {
    const res = await fetch("/api/upload/product-image", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    return res.ok;
  } catch (error) {
    console.warn("[deleteProductImage] no se pudo borrar (best-effort):", error);
    return false;
  }
}
