/**
 * Prueba pura (sin DB, sin red, sin tocar productos reales) del sistema de
 * temas estructurales: resolución/fallback de `storefront_theme`
 * (lib/store-settings/storefrontThemes.ts) y la estrategia de orden de
 * bloques por tema (lib/product/sections/sortSectionsForTheme.ts).
 *
 * Uso: npx tsx scripts/verify-storefront-themes.ts
 */
import {
  STOREFRONT_THEME_IDS,
  STOREFRONT_THEME_LIST,
  DEFAULT_STOREFRONT_THEME,
  resolveStorefrontTheme,
} from "../lib/store-settings/storefrontThemes";
import { sortSectionsForTheme } from "../lib/product/sections/sortSectionsForTheme";
import type { ProductSection } from "../lib/product/sections/types";

let failures = 0;
function assert(condition: unknown, message: string): void {
  if (condition) {
    console.log(`  OK: ${message}`);
  } else {
    failures += 1;
    console.error(`  FALLO: ${message}`);
  }
}

console.log("[1] resolveStorefrontTheme: valores válidos pasan tal cual");
{
  for (const id of STOREFRONT_THEME_IDS) {
    assert(resolveStorefrontTheme(id) === id, `"${id}" se resuelve a sí mismo`);
  }
}

console.log("\n[2] resolveStorefrontTheme: fallback seguro para valores inválidos/legados/vacíos");
{
  assert(resolveStorefrontTheme(null) === DEFAULT_STOREFRONT_THEME, "null -> conversion");
  assert(resolveStorefrontTheme(undefined) === DEFAULT_STOREFRONT_THEME, "undefined -> conversion");
  assert(resolveStorefrontTheme("") === DEFAULT_STOREFRONT_THEME, "string vacío -> conversion");
  assert(resolveStorefrontTheme("premium_dark") === DEFAULT_STOREFRONT_THEME, "un preset visual por error -> conversion (no son el mismo enum)");
  assert(resolveStorefrontTheme("legacy_theme_borrado") === DEFAULT_STOREFRONT_THEME, "valor legado desconocido -> conversion");
  assert(DEFAULT_STOREFRONT_THEME === "conversion", "el default de resolveStorefrontTheme coincide con el default de la columna");
}

console.log("\n[3] Registro STOREFRONT_THEME_LIST: 4 temas, cada uno con nombre/descripción/nicho/estructura no vacíos");
{
  assert(STOREFRONT_THEME_LIST.length === 4, `hay 4 temas (obtuvo ${STOREFRONT_THEME_LIST.length})`);
  for (const theme of STOREFRONT_THEME_LIST) {
    assert(theme.name.trim().length > 0, `${theme.id}: tiene nombre`);
    assert(theme.description.trim().length > 0, `${theme.id}: tiene descripción`);
    assert(theme.recommendedFor.trim().length > 0, `${theme.id}: tiene nicho recomendado`);
    assert(theme.structure.length > 0, `${theme.id}: tiene estructura definida`);
  }
}

// ─── sortSectionsForTheme ────────────────────────────────────────────────────

let seq = 0;
function makeSection(type: ProductSection["type"], order: number): ProductSection {
  seq += 1;
  const id = `sec-${seq}`;
  switch (type) {
    case "benefits":
      return {
        id,
        enabled: true,
        order,
        type: "benefits",
        data: { image_url: "", items: [{ icon: "star", title: "T", description: "D" }] },
      };
    case "usage":
      return { id, enabled: true, order, type: "usage", data: { image_url: "" } };
    case "measurements":
      return { id, enabled: true, order, type: "measurements", data: { image_url: "" } };
    case "versatility":
      return { id, enabled: true, order, type: "versatility", data: { image_url: "" } };
    case "faq":
      return {
        id,
        enabled: true,
        order,
        type: "faq",
        data: { items: [{ question: "Q", answer: "A" }] },
      };
    case "media_strip":
      return { id, enabled: true, order, type: "media_strip", data: { image_url: "", aspect: "16/9" } };
    case "testimonials":
      return {
        id,
        enabled: true,
        order,
        type: "testimonials",
        data: { items: [{ name: "N", comment: "C" }] },
      };
    case "before_after":
      return { id, enabled: true, order, type: "before_after", data: { layout: "side_by_side" } };
    case "visual_sequence":
      return { id, enabled: true, order, type: "visual_sequence", data: { slides: [] } };
    default: {
      const _exhaustive: never = type;
      throw new Error(`tipo no soportado en el test: ${_exhaustive}`);
    }
  }
}

console.log("\n[4] sortSectionsForTheme('wellness'): beneficios -> uso -> versatilidad -> resto");
{
  const faq = makeSection("faq", 0);
  const versatility = makeSection("versatility", 1);
  const usage = makeSection("usage", 2);
  const benefits = makeSection("benefits", 3);
  const original = [faq, versatility, usage, benefits];
  const sorted = sortSectionsForTheme(original, "wellness").map((s) => s.type);
  assert(
    JSON.stringify(sorted) === JSON.stringify(["benefits", "usage", "versatility", "faq"]),
    `orden esperado: beneficios, uso, versatilidad, resto (obtuvo ${JSON.stringify(sorted)})`
  );
  assert(original[0] === faq && original[0].order === 0, "el array original no se muta");
}

console.log("\n[5] sortSectionsForTheme('technical'): medidas -> versatilidad -> uso -> resto");
{
  const testimonials = makeSection("testimonials", 0);
  const usage = makeSection("usage", 1);
  const measurements = makeSection("measurements", 2);
  const versatility = makeSection("versatility", 3);
  const sorted = sortSectionsForTheme([testimonials, usage, measurements, versatility], "technical").map(
    (s) => s.type
  );
  assert(
    JSON.stringify(sorted) === JSON.stringify(["measurements", "versatility", "usage", "testimonials"]),
    `orden esperado: medidas, versatilidad, uso, resto (obtuvo ${JSON.stringify(sorted)})`
  );
}

console.log("\n[6] sortSectionsForTheme: dentro de un mismo grupo de prioridad se preserva el orden original (estable)");
{
  const benefitsA = makeSection("benefits", 0);
  const benefitsB = makeSection("benefits", 1);
  const usage = makeSection("usage", 2);
  const sorted = sortSectionsForTheme([usage, benefitsB, benefitsA], "wellness");
  assert(sorted[0].id === benefitsB.id && sorted[1].id === benefitsA.id, "los dos 'benefits' mantienen su orden relativo original (B antes que A, como venían)");
  assert(sorted[2].id === usage.id, "usage queda al final de su grupo");
}

console.log("\n[7] sortSectionsForTheme: 'conversion' y 'offer' no reordenan — se respeta el order del admin");
{
  const versatility = makeSection("versatility", 0);
  const benefits = makeSection("benefits", 1);
  const faq = makeSection("faq", 2);
  const original = [versatility, benefits, faq];
  const sortedConversion = sortSectionsForTheme(original, "conversion");
  const sortedOffer = sortSectionsForTheme(original, "offer");
  assert(sortedConversion === original, "conversion: devuelve la misma referencia (passthrough, sin reordenar)");
  assert(sortedOffer === original, "offer: devuelve la misma referencia (passthrough, sin reordenar)");
}

console.log("\n[8] sortSectionsForTheme: nunca altera el contenido de una sección, solo su posición");
{
  const benefits = makeSection("benefits", 0);
  const usage = makeSection("usage", 1);
  const sorted = sortSectionsForTheme([usage, benefits], "wellness");
  const sortedBenefits = sorted.find((s) => s.type === "benefits");
  assert(
    sortedBenefits === benefits,
    "la sección 'benefits' reordenada es exactamente el mismo objeto (misma referencia), no una copia ni una versión alterada"
  );
}

if (failures > 0) {
  console.error(`\n${failures} aserción(es) fallaron.`);
  process.exitCode = 1;
} else {
  console.log("\nTodas las aserciones pasaron. Funciones puras, sin DB ni red, no se tocó ningún dato real.");
  process.exitCode = 0;
}
