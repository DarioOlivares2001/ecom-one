/**
 * Prueba pura (sin DB, sin red, sin tocar productos reales) de la
 * visibilidad del catálogo público tras crear/editar/archivar/restaurar un
 * producto.
 *
 * Causa raíz confirmada con evidencia (ver informe): `@neondatabase/serverless`
 * (driver HTTP de Neon) usa `fetch()` nativo para cada consulta, y Next.js
 * parchea `fetch()` global para pasar por su Data Cache persistente
 * (`.next/cache/fetch-cache`, sobrevive incluso entre builds). Sin
 * `cache: "no-store"` en el cliente de Neon (`lib/db/client.ts`), una
 * consulta podía quedar cacheada por esa capa aunque la ruta que la llama
 * sea dinámica — así un producto recién activado quedaba invisible en
 * `/productos` indefinidamente. La invalidación dirigida de rutas
 * (`lib/product/revalidateCatalog.ts`, usada por las acciones de admin) es
 * la segunda capa: purga el cache de página/RSC de `/`, `/productos` y
 * `/productos/[slug]` en cada mutación, como defensa adicional.
 *
 * Esta prueba no ejecuta un build ni toca Neon: (1) inyecta una función
 * `revalidate` de prueba en vez de la `revalidatePath` real de `next/cache`
 * y verifica exactamente qué rutas se invalidan en cada caso, y (2) revisa
 * el código fuente de `lib/db/client.ts` para asegurar que el fix de
 * `cache: "no-store"` sigue presente (red de regresión — nunca ejecuta la
 * consulta real).
 *
 * Uso: npx tsx scripts/verify-catalog-revalidation.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { revalidateProductCatalog } from "../lib/product/revalidateCatalog";

let failures = 0;
function assert(condition: unknown, message: string): void {
  if (condition) {
    console.log(`  OK: ${message}`);
  } else {
    failures += 1;
    console.error(`  FALLO: ${message}`);
  }
}

console.log("[1] Crear/editar con slug conocido: invalida /, /productos y /productos/[slug]");
{
  const calls: string[] = [];
  revalidateProductCatalog("secadora-portatil-de-viaje-600-w", (path) => calls.push(path));
  assert(calls.includes("/productos"), `/productos fue invalidado (obtuvo: ${JSON.stringify(calls)})`);
  assert(calls.includes("/"), "/ fue invalidado");
  assert(calls.includes("/productos/secadora-portatil-de-viaje-600-w"), "/productos/[slug] fue invalidado con el slug exacto");
  assert(calls.length === 3, `se invalidaron exactamente 3 rutas, ninguna extra (obtuvo: ${JSON.stringify(calls)})`);
  assert(calls[0] === "/productos" && calls[1] === "/", "el orden invalida primero el listado y el home");
}

console.log("\n[2] Archivar/restaurar sin slug conocido: invalida solo / y /productos, nunca una ruta de slug vacía");
{
  const calls: string[] = [];
  revalidateProductCatalog(undefined, (path) => calls.push(path));
  assert(JSON.stringify(calls) === JSON.stringify(["/productos", "/"]), `solo /productos y / (obtuvo: ${JSON.stringify(calls)})`);
  assert(!calls.some((p) => p.startsWith("/productos/")), "nunca genera una ruta /productos/ vacía o inválida");
}

console.log("\n[3] slug null se trata igual que 'sin slug' (no revienta, no genera /productos/null)");
{
  const calls: string[] = [];
  revalidateProductCatalog(null, (path) => calls.push(path));
  assert(JSON.stringify(calls) === JSON.stringify(["/productos", "/"]), `slug null -> igual que sin slug (obtuvo: ${JSON.stringify(calls)})`);
}

console.log("\n[4] slug en blanco (solo espacios) se trata como ausente, nunca genera /productos/%20 ni similar");
{
  const calls: string[] = [];
  revalidateProductCatalog("   ", (path) => calls.push(path));
  assert(JSON.stringify(calls) === JSON.stringify(["/productos", "/"]), `slug en blanco -> igual que sin slug (obtuvo: ${JSON.stringify(calls)})`);
}

console.log("\n[5] El slug se recorta (trim) antes de construir la ruta");
{
  const calls: string[] = [];
  revalidateProductCatalog("  mi-producto  ", (path) => calls.push(path));
  assert(calls.includes("/productos/mi-producto"), `slug con espacios se recorta correctamente (obtuvo: ${JSON.stringify(calls)})`);
}

console.log('\n[6] Red de regresión: lib/db/client.ts sigue deshabilitando el cache de fetch para Neon (causa raíz real)');
{
  const clientSource = readFileSync(join(__dirname, "..", "lib", "db", "client.ts"), "utf8");
  assert(
    /neon\(\s*databaseUrl\s*,\s*\{\s*fetchOptions:\s*\{\s*cache:\s*["']no-store["']/.test(clientSource),
    'neon() sigue construido con fetchOptions: { cache: "no-store" } — si esto se borra, las consultas a Neon vuelven a poder quedar cacheadas por el fetch cache de Next.'
  );
}

if (failures > 0) {
  console.error(`\n${failures} aserción(es) fallaron.`);
  process.exitCode = 1;
} else {
  console.log("\nTodas las aserciones pasaron. No se llamó a la revalidatePath real de Next ni se tocó Neon/productos reales (función 100% mockeada).");
  process.exitCode = 0;
}
