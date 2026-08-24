/**
 * Prueba pura (sin DB, sin red, sin tocar productos reales) del ranking de
 * "También te puede interesar" (`pickProductUpsellSuggestions`,
 * `lib/product/upsell.ts`).
 *
 * Cubre exactamente los 7 casos pedidos: misma categoría; categoría con
 * acentos/mayúsculas distintas; coincidencia por tags cuando no alcanza la
 * categoría; fallback genérico; exclusión del producto actual; exclusión de
 * inactivos/eliminados/sin stock; orden determinista (más recientes primero
 * dentro de cada grupo).
 *
 * Uso: npx tsx scripts/verify-product-upsell-ranking.ts
 */
import { pickProductUpsellSuggestions, normalizeCatalogText } from "../lib/product/upsell";
import type { Product } from "../lib/db/types";

let failures = 0;
function assert(condition: unknown, message: string): void {
  if (condition) {
    console.log(`  OK: ${message}`);
  } else {
    failures += 1;
    console.error(`  FALLO: ${message}`);
  }
}

let seq = 0;
function makeProduct(overrides: Partial<Product>): Product {
  seq += 1;
  return {
    id: overrides.id ?? `id-${seq}`,
    slug: overrides.slug ?? `slug-${seq}`,
    name: overrides.name ?? `Producto ${seq}`,
    description: null,
    price: 10000,
    compare_at_price: null,
    cost_price: null,
    stock: 5,
    images: ["https://ecom-one-media.example.com/products/foto.png"],
    product_media: [],
    category: null,
    tags: [],
    variants: null,
    has_variants: false,
    options: null,
    meta_title: null,
    meta_desc: null,
    dropi_product_url: null,
    active: true,
    discount_enabled: false,
    discount_max_percent: 0,
    discount_steps: [],
    discount_label: null,
    product_sections: null,
    deleted_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

console.log("[1] Prioriza misma categoría sobre el resto");
{
  const current = makeProduct({ id: "current", category: "Aceites" });
  const sameCategory = makeProduct({ id: "same-cat", category: "Aceites" });
  const otherCategory = makeProduct({ id: "other-cat", category: "Velas" });
  const out = pickProductUpsellSuggestions(current, [otherCategory, sameCategory], 4);
  assert(out.length === 2, `devuelve ambos candidatos (obtuvo ${out.length})`);
  assert(out[0].id === "same-cat", `el de la misma categoría va primero (obtuvo ${out[0]?.id})`);
}

console.log("\n[2] Comparación de categoría tolera acentos, mayúsculas y espacios");
{
  const current = makeProduct({ id: "current", category: "  Aromaterapia  " });
  const match = makeProduct({ id: "match", category: "AROMATERAPIA" });
  const matchAccent = makeProduct({ id: "match-accent", category: "aromaterápia" });
  const noMatch = makeProduct({ id: "no-match", category: "Cocina" });
  const out = pickProductUpsellSuggestions(current, [noMatch, match, matchAccent], 4);
  assert(
    out.slice(0, 2).every((s) => s.id === "match" || s.id === "match-accent"),
    `ambas variantes normalizadas de "aromaterapia" quedan primero (obtuvo ${out.map((s) => s.id).join(",")})`
  );
  assert(
    normalizeCatalogText("Aromaterápia") === normalizeCatalogText("AROMATERAPIA"),
    "normalizeCatalogText ignora acentos y mayúsculas"
  );
}

console.log("\n[3] Sin suficiente categoría, completa con coincidencia de tags");
{
  const current = makeProduct({ id: "current", category: "Aceites", tags: ["relajante", "lavanda"] });
  const sameCategory = makeProduct({ id: "same-cat", category: "Aceites" });
  const tagMatch = makeProduct({ id: "tag-match", category: "Velas", tags: ["Lavanda"] });
  const noRelation = makeProduct({ id: "no-relation", category: "Cocina", tags: ["acero"] });
  const out = pickProductUpsellSuggestions(current, [noRelation, tagMatch, sameCategory], 4);
  assert(out.map((s) => s.id)[0] === "same-cat", "misma categoría sigue primero");
  assert(out.map((s) => s.id)[1] === "tag-match", "coincidencia de tag va antes que el fallback genérico");
  assert(out.map((s) => s.id)[2] === "no-relation", "el resto llena el cupo restante como fallback");
}

console.log("\n[4] Sin categoría ni tags en común, cae a fallback de cualquier producto activo");
{
  const current = makeProduct({ id: "current", category: "Aceites", tags: ["lavanda"] });
  const fallback1 = makeProduct({ id: "fallback-1", category: "Cocina", tags: ["acero"] });
  const fallback2 = makeProduct({ id: "fallback-2", category: "Ropa", tags: ["algodon"] });
  const out = pickProductUpsellSuggestions(current, [fallback1, fallback2], 4);
  assert(out.length === 2, `usa el fallback cuando no hay categoría ni tags en común (obtuvo ${out.length})`);
}

console.log("\n[5] Nunca incluye el producto actual");
{
  const current = makeProduct({ id: "current", category: "Aceites" });
  const other = makeProduct({ id: "other", category: "Aceites" });
  const out = pickProductUpsellSuggestions(current, [current, other], 4);
  assert(!out.some((s) => s.id === "current"), "el producto actual no aparece entre sus propias sugerencias");
  assert(out.length === 1 && out[0].id === "other", "solo queda el otro producto");
}

console.log("\n[6] Excluye inactivos, eliminados y sin stock");
{
  const current = makeProduct({ id: "current", category: "Aceites" });
  const inactive = makeProduct({ id: "inactive", category: "Aceites", active: false });
  const deleted = makeProduct({ id: "deleted", category: "Aceites", deleted_at: "2026-01-02T00:00:00.000Z" });
  const noStock = makeProduct({ id: "no-stock", category: "Aceites", stock: 0 });
  const hasVariants = makeProduct({ id: "has-variants", category: "Aceites", has_variants: true });
  const valid = makeProduct({ id: "valid", category: "Aceites" });
  const out = pickProductUpsellSuggestions(
    current,
    [inactive, deleted, noStock, hasVariants, valid],
    4
  );
  assert(out.length === 1 && out[0].id === "valid", `solo el producto válido pasa el filtro (obtuvo ${JSON.stringify(out.map((s) => s.id))})`);
}

console.log("\n[7] Orden determinista: dentro de cada grupo, más recientes primero, y la misma entrada da la misma salida");
{
  const current = makeProduct({ id: "current", category: "Aceites" });
  const older = makeProduct({ id: "older", category: "Aceites", created_at: "2026-01-01T00:00:00.000Z" });
  const newer = makeProduct({ id: "newer", category: "Aceites", created_at: "2026-02-01T00:00:00.000Z" });
  const middle = makeProduct({ id: "middle", category: "Aceites", created_at: "2026-01-15T00:00:00.000Z" });
  const pool = [older, newer, middle];
  const out1 = pickProductUpsellSuggestions(current, pool, 4).map((s) => s.id);
  const out2 = pickProductUpsellSuggestions(current, pool, 4).map((s) => s.id);
  assert(JSON.stringify(out1) === JSON.stringify(["newer", "middle", "older"]), `orden por fecha desc (obtuvo ${JSON.stringify(out1)})`);
  assert(JSON.stringify(out1) === JSON.stringify(out2), "misma entrada produce siempre la misma salida");
}

console.log("\n[8] Nunca supera el máximo pedido (4 por defecto en la ficha de producto)");
{
  const current = makeProduct({ id: "current", category: "Aceites" });
  const pool = Array.from({ length: 10 }, (_, i) =>
    makeProduct({ id: `p${i}`, category: "Aceites", created_at: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z` })
  );
  const out = pickProductUpsellSuggestions(current, pool, 4);
  assert(out.length === 4, `nunca devuelve más de 4 (obtuvo ${out.length})`);
}

console.log("\n[9] allowGenericFallback: false nunca completa con productos sin relación real (tema Bienestar)");
{
  const current = makeProduct({ id: "current", category: "Suplementos", tags: ["magnesio"] });
  const unrelated1 = makeProduct({ id: "unrelated-1", category: "Herramientas", tags: ["taladro"] });
  const unrelated2 = makeProduct({ id: "unrelated-2", category: "Cocina", tags: ["sarten"] });

  const withFallback = pickProductUpsellSuggestions(current, [unrelated1, unrelated2], 4, {
    allowGenericFallback: true,
  });
  assert(
    withFallback.length === 2,
    `por defecto (allowGenericFallback: true) sigue completando con lo que haya (obtuvo ${withFallback.length})`
  );

  const withoutFallback = pickProductUpsellSuggestions(current, [unrelated1, unrelated2], 4, {
    allowGenericFallback: false,
  });
  assert(
    withoutFallback.length === 0,
    `allowGenericFallback: false no muestra nada si no hay categoría ni tags en común (obtuvo ${JSON.stringify(withoutFallback.map((s) => s.id))})`
  );

  const sameCategoryProduct = makeProduct({ id: "same-cat", category: "Suplementos" });
  const tagMatchProduct = makeProduct({ id: "tag-match", category: "Otra", tags: ["magnesio"] });
  const withRealMatches = pickProductUpsellSuggestions(
    current,
    [unrelated1, sameCategoryProduct, tagMatchProduct],
    4,
    { allowGenericFallback: false }
  );
  assert(
    withRealMatches.length === 2 &&
      withRealMatches.every((s) => s.id === "same-cat" || s.id === "tag-match"),
    `allowGenericFallback: false SÍ muestra coincidencias reales de categoría/tags, solo excluye el relleno genérico (obtuvo ${JSON.stringify(withRealMatches.map((s) => s.id))})`
  );
}

if (failures > 0) {
  console.error(`\n${failures} aserción(es) fallaron.`);
  process.exitCode = 1;
} else {
  console.log("\nTodas las aserciones pasaron. Función pura, sin DB ni red, no se tocó ningún producto real.");
  process.exitCode = 0;
}
