/**
 * Productos que en catálogo no deben agregarse al carrito sin elegir variante en la ficha.
 * Usa `has_variants` de BD; si falta la columna en el payload, infiere por `variants` no vacío.
 */
export function productRequiresVariantChoice(product: {
  has_variants?: boolean | null;
  variants?: unknown;
}): boolean {
  if (product.has_variants === true) return true;
  if (product.has_variants === false || product.has_variants === null) return false;
  const v = product.variants;
  return Array.isArray(v) && v.length > 0;
}
