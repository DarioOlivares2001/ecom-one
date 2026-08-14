/**
 * Categorías del catálogo: siempre derivadas de `product.category` (texto
 * libre asignado por el admin al crear/editar un producto), nunca de una
 * lista fija en código.
 */
export function normalizeProductCategory(raw: string | null | undefined): string {
  return String(raw ?? "").trim();
}

export function sortCategoriesForStore(categories: string[]): string[] {
  return [...categories].sort((a, b) => a.localeCompare(b, "es"));
}

