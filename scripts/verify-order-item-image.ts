/**
 * Prueba unitaria pura de lib/orders/resolveOrderItemImage.ts — sin DB, sin
 * red. Cero dependencias del módulo, así que corre directo con tsx.
 */
import { resolveOrderItemImage } from "../lib/orders/resolveOrderItemImage";

let failures = 0;
function assert(condition: unknown, message: string): void {
  if (condition) {
    console.log(`  OK: ${message}`);
  } else {
    failures += 1;
    console.error(`  FALLO: ${message}`);
  }
}

console.log("[1] Snapshot válida en la línea: se usa como snapshot; fallback distinto se conserva aparte");
{
  const r = resolveOrderItemImage(
    { product_id: "p1", image: "https://pub-xyz.r2.dev/products/a.webp" },
    { p1: "https://pub-xyz.r2.dev/products/current.webp" }
  );
  assert(r.snapshot === "https://pub-xyz.r2.dev/products/a.webp", "snapshot = item.image");
  assert(r.fallback === "https://pub-xyz.r2.dev/products/current.webp", "fallback = imagen actual del producto (distinta)");
}

console.log("\n[1b] Snapshot igual a la imagen actual: fallback se anula (no reintentar la misma URL)");
{
  const r = resolveOrderItemImage(
    { product_id: "p1", image: "https://pub-xyz.r2.dev/products/a.webp" },
    { p1: "https://pub-xyz.r2.dev/products/a.webp" }
  );
  assert(r.snapshot === "https://pub-xyz.r2.dev/products/a.webp", "snapshot se conserva");
  assert(r.fallback === null, "fallback null cuando es idéntico al snapshot");
}

console.log("\n[2] Pedido histórico sin snapshot: snapshot null, fallback = imagen actual del producto");
{
  const cases: Array<[unknown, string]> = [
    [null, "image null"],
    [undefined, "image ausente"],
    ["", "image string vacío"],
    ["   ", "image solo espacios"],
  ];
  for (const [imageValue, label] of cases) {
    const r = resolveOrderItemImage(
      { product_id: "p1", image: imageValue },
      { p1: "https://pub-xyz.r2.dev/products/current.webp" }
    );
    assert(r.snapshot === null, `${label} → snapshot null`);
    assert(r.fallback === "https://pub-xyz.r2.dev/products/current.webp", `${label} → fallback = imagen actual`);
  }
}

console.log("\n[3] Producto sin imagen (ni snapshot ni actual): ambos null → el caller debe mostrar placeholder");
{
  const cases: Array<[Record<string, string | null> | undefined, string]> = [
    [{ p2: null }, "productImages[id] es null"],
    [{}, "product_id no está en el mapa"],
    [undefined, "productImages undefined"],
  ];
  for (const [productImages, label] of cases) {
    const r = resolveOrderItemImage({ product_id: "p2", image: null }, productImages);
    assert(r.snapshot === null && r.fallback === null, `${label} → snapshot y fallback null`);
  }
  const r = resolveOrderItemImage({ image: null }, { p1: "https://x" });
  assert(r.snapshot === null && r.fallback === null, "sin product_id en absoluto → snapshot y fallback null");
}

console.log("\n[Extra] Producto id no-string se ignora de forma segura");
{
  const r = resolveOrderItemImage({ product_id: 123, image: null }, { "123": "https://x" });
  assert(
    r.snapshot === null && r.fallback === null,
    "product_id numérico no castea a string mágicamente (comportamiento intencional y seguro)"
  );
}

if (failures > 0) {
  console.error(`\n${failures} aserción(es) fallaron.`);
  process.exitCode = 1;
} else {
  console.log("\nTodas las aserciones pasaron.");
  process.exitCode = 0;
}
