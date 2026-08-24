/**
 * Prueba pura (sin DB, sin red, sin tocar productos reales) del sistema de
 * temas estructurales: resolución/fallback de `storefront_theme`
 * (lib/store-settings/storefrontThemes.ts) — incluidos los alias legados de
 * la iteración anterior (4 temas) hacia los 2 vigentes — y la estrategia de
 * orden de bloques por tema (lib/product/sections/sortSectionsForTheme.ts).
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
  assert(STOREFRONT_THEME_IDS.length === 2, `hay exactamente 2 temas estructurales (obtuvo ${STOREFRONT_THEME_IDS.length})`);
}

console.log("\n[2] resolveStorefrontTheme: fallback seguro para valores inválidos/vacíos");
{
  assert(resolveStorefrontTheme(null) === DEFAULT_STOREFRONT_THEME, "null -> conversion-general");
  assert(resolveStorefrontTheme(undefined) === DEFAULT_STOREFRONT_THEME, "undefined -> conversion-general");
  assert(resolveStorefrontTheme("") === DEFAULT_STOREFRONT_THEME, "string vacío -> conversion-general");
  assert(resolveStorefrontTheme("premium_dark") === DEFAULT_STOREFRONT_THEME, "un preset visual por error -> conversion-general (no son el mismo enum)");
  assert(resolveStorefrontTheme("algo-inventado") === DEFAULT_STOREFRONT_THEME, "valor desconocido -> conversion-general");
  assert(DEFAULT_STOREFRONT_THEME === "conversion-general", "el default de resolveStorefrontTheme coincide con el default de la columna");
}

console.log("\n[3] resolveStorefrontTheme: alias legados de la iteración anterior (4 temas) siguen funcionando sin migrar datos");
{
  assert(
    resolveStorefrontTheme("conversion") === "conversion-general",
    "id legado 'conversion' -> 'conversion-general' (instalaciones existentes con este valor guardado)"
  );
  assert(
    resolveStorefrontTheme("wellness") === "wellness-supplements",
    "id legado 'wellness' -> 'wellness-supplements'"
  );
  assert(
    resolveStorefrontTheme("technical") === DEFAULT_STOREFRONT_THEME,
    "id legado 'technical' (tema eliminado, nunca existió como opción final) -> default, no revienta"
  );
  assert(
    resolveStorefrontTheme("offer") === DEFAULT_STOREFRONT_THEME,
    "id legado 'offer' (tema eliminado) -> default, no revienta"
  );
}

console.log("\n[4] Registro STOREFRONT_THEME_LIST: 2 temas, cada uno con nombre/descripción/nicho/estructura no vacíos");
{
  assert(STOREFRONT_THEME_LIST.length === 2, `hay 2 temas (obtuvo ${STOREFRONT_THEME_LIST.length})`);
  for (const theme of STOREFRONT_THEME_LIST) {
    assert(theme.name.trim().length > 0, `${theme.id}: tiene nombre`);
    assert(theme.description.trim().length > 0, `${theme.id}: tiene descripción`);
    assert(theme.recommendedFor.trim().length > 0, `${theme.id}: tiene nicho recomendado`);
    assert(theme.structure.length > 0, `${theme.id}: tiene estructura definida`);
  }
  const wellness = STOREFRONT_THEME_LIST.find((t) => t.id === "wellness-supplements")!;
  assert(
    wellness.structure.some((s) => /home/i.test(s)) &&
      wellness.structure.some((s) => /cat[aá]logo/i.test(s)) &&
      wellness.structure.some((s) => /ficha/i.test(s)),
    "la estructura documentada de Bienestar cubre Home, Catálogo y Ficha (no solo la ficha de producto)"
  );
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
    case "quantity_packs":
      return {
        id,
        enabled: true,
        order,
        type: "quantity_packs",
        data: { steps: [{ minQty: 2 }], mostChosenMinQty: null },
      };
    case "offer_countdown":
      return { id, enabled: true, order, type: "offer_countdown", data: { ends_at: "" } };
    default: {
      const _exhaustive: never = type;
      throw new Error(`tipo no soportado en el test: ${_exhaustive}`);
    }
  }
}

console.log("\n[5] sortSectionsForTheme('wellness-supplements'): beneficios -> uso -> confianza (testimonios) -> resto");
{
  const faq = makeSection("faq", 0);
  const testimonials = makeSection("testimonials", 1);
  const usage = makeSection("usage", 2);
  const benefits = makeSection("benefits", 3);
  const original = [faq, testimonials, usage, benefits];
  const sorted = sortSectionsForTheme(original, "wellness-supplements").map((s) => s.type);
  assert(
    JSON.stringify(sorted) === JSON.stringify(["benefits", "usage", "testimonials", "faq"]),
    `orden esperado: beneficios, uso, confianza, resto (obtuvo ${JSON.stringify(sorted)})`
  );
  assert(original[0] === faq && original[0].order === 0, "el array original no se muta");
}

console.log("\n[6] sortSectionsForTheme: dentro de un mismo grupo de prioridad se preserva el orden original (estable)");
{
  const benefitsA = makeSection("benefits", 0);
  const benefitsB = makeSection("benefits", 1);
  const usage = makeSection("usage", 2);
  const sorted = sortSectionsForTheme([usage, benefitsB, benefitsA], "wellness-supplements");
  assert(
    sorted[0].id === benefitsB.id && sorted[1].id === benefitsA.id,
    "los dos 'benefits' mantienen su orden relativo original (B antes que A, como venían)"
  );
  assert(sorted[2].id === usage.id, "usage queda al final de su grupo");
}

console.log("\n[7] sortSectionsForTheme: 'conversion-general' no reordena — se respeta el order del admin");
{
  const versatility = makeSection("versatility", 0);
  const benefits = makeSection("benefits", 1);
  const faq = makeSection("faq", 2);
  const original = [versatility, benefits, faq];
  const sorted = sortSectionsForTheme(original, "conversion-general");
  assert(sorted === original, "conversion-general: devuelve la misma referencia (passthrough, sin reordenar)");
}

console.log("\n[8] sortSectionsForTheme: nunca altera el contenido de una sección, solo su posición");
{
  const benefits = makeSection("benefits", 0);
  const usage = makeSection("usage", 1);
  const sorted = sortSectionsForTheme([usage, benefits], "wellness-supplements");
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
