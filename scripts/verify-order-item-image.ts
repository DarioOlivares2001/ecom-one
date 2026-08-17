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

console.log("[1] Snapshot válida en la línea: se usa tal cual, sin tocar el fallback");
assert(
  resolveOrderItemImage(
    { product_id: "p1", image: "https://pub-xyz.r2.dev/products/a.webp" },
    { p1: "https://pub-xyz.r2.dev/products/current.webp" }
  ) === "https://pub-xyz.r2.dev/products/a.webp",
  "usa item.image cuando existe, ignora productImages"
);

console.log("\n[2] Pedido histórico sin snapshot: cae a la imagen actual del producto");
assert(
  resolveOrderItemImage({ product_id: "p1", image: null }, { p1: "https://pub-xyz.r2.dev/products/current.webp" }) ===
    "https://pub-xyz.r2.dev/products/current.webp",
  "image null → usa productImages[product_id]"
);
assert(
  resolveOrderItemImage({ product_id: "p1" }, { p1: "https://pub-xyz.r2.dev/products/current.webp" }) ===
    "https://pub-xyz.r2.dev/products/current.webp",
  "image ausente (campo ni siquiera existe) → usa productImages[product_id]"
);
assert(
  resolveOrderItemImage({ product_id: "p1", image: "" }, { p1: "https://pub-xyz.r2.dev/products/current.webp" }) ===
    "https://pub-xyz.r2.dev/products/current.webp",
  "image string vacío → usa productImages[product_id]"
);
assert(
  resolveOrderItemImage({ product_id: "p1", image: "   " }, { p1: "https://pub-xyz.r2.dev/products/current.webp" }) ===
    "https://pub-xyz.r2.dev/products/current.webp",
  "image solo espacios → usa productImages[product_id]"
);

console.log("\n[3] Producto sin imagen (ni snapshot ni actual): null → el caller debe mostrar placeholder");
assert(resolveOrderItemImage({ product_id: "p2", image: null }, { p2: null }) === null, "productImages[id] es null → null");
assert(resolveOrderItemImage({ product_id: "p2", image: null }, {}) === null, "product_id no está en el mapa → null");
assert(resolveOrderItemImage({ product_id: "p2", image: null }, undefined) === null, "productImages undefined → null");
assert(resolveOrderItemImage({ image: null }, { p1: "https://x" }) === null, "sin product_id en absoluto → null");

console.log("\n[Extra] Producto id no-string se ignora de forma segura");
assert(resolveOrderItemImage({ product_id: 123, image: null }, { "123": "https://x" }) === null, "product_id numérico no castea a string mágicamente (comportamiento intencional y seguro)");

if (failures > 0) {
  console.error(`\n${failures} aserción(es) fallaron.`);
  process.exitCode = 1;
} else {
  console.log("\nTodas las aserciones pasaron.");
  process.exitCode = 0;
}
