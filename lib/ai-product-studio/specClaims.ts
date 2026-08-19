import type { ProductSection } from "@/lib/product/sections/types";
import { DIMENSIONS_PATTERN_SOURCE, extractExplicitDimensions } from "@/lib/product/sections/extractDimensions";

/**
 * Red de seguridad server-side contra especificaciones técnicas que el
 * modelo hubiera mencionado SIN respaldo en `supplierText` (potencia,
 * medidas, temporizador, enchufe universal, voltaje, certificaciones,
 * garantía, promesas de salud). No confía en que el prompt baste: si el
 * patrón no aparece también en el texto de origen, se elimina del borrador
 * y se deja constancia en `claimsToAvoid`.
 *
 * Solo aplica a las 4 secciones que el generador de IA puede producir
 * (benefits/usage/measurements/versatility) — ver `generateAIDraft.ts`.
 */

export interface GuardedClaim {
  id: string;
  label: string;
  pattern: RegExp;
}

export const GUARDED_CLAIMS: GuardedClaim[] = [
  { id: "power", label: "potencia", pattern: /\b\d+\s*w(atts?)?\b/gi },
  { id: "dimensions", label: "medidas", pattern: new RegExp(DIMENSIONS_PATTERN_SOURCE, "gi") },
  { id: "timer", label: "temporizador", pattern: /\btemporizador(es)?\b/gi },
  { id: "universal_plug", label: "enchufe universal", pattern: /\benchufe\s+universal\b/gi },
  { id: "voltage", label: "voltaje", pattern: /\b\d+\s*v(oltios?)?\b/gi },
  { id: "certification", label: "certificación", pattern: /\bcertificaci[oó]n(es)?\b|\bcertificad[oa]\b|\biso\s?\d{3,5}\b/gi },
  { id: "warranty", label: "garantía", pattern: /\bgarant[ií]a\b/gi },
  { id: "medical", label: "uso médico/salud", pattern: /\b(cura|trata|alivia|terap[eé]utic\w*|medicinal)\b/gi },
  { id: "capacity", label: "capacidad de carga", pattern: /\bcapacidad\s+de\s+carga\b|\b\d+\s*(l|litros|kg)\s+de\s+capacidad\b/gi },
  { id: "uv", label: "UV", pattern: /\buv\b/gi },
  { id: "electrical_safety", label: "seguridad eléctrica", pattern: /\bseguridad\s+el[eé]ctrica\b/gi },
  { id: "drying_time", label: "tiempo de secado", pattern: /\bsec[ao](do)?\s+en\s+\d*\s*minutos?\b|\bseca(do)?\s+en\s+minutos\b/gi },
  { id: "delivery_promise", label: "promesa de despacho", pattern: /\bentrega\s+(r[aá]pida|garantizada|en\s+\d+\s*(horas?|d[ií]as?))\b|\bdespacho\s+(gratis|express|garantizado)(\s+garantizado)?\b/gi },
];

export { extractExplicitDimensions };

function hasMatch(text: string, pattern: RegExp): boolean {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

function stripMatches(text: string, pattern: RegExp): string {
  pattern.lastIndex = 0;
  return text.replace(pattern, "");
}

function stripGuardedClaims(text: string, unanchored: GuardedClaim[]): { text: string; removedLabels: string[] } {
  let result = text;
  const removedLabels: string[] = [];
  for (const claim of unanchored) {
    if (hasMatch(result, claim.pattern)) {
      removedLabels.push(claim.label);
      result = stripMatches(result, claim.pattern);
    }
  }
  if (removedLabels.length > 0) {
    result = result.replace(/\s{2,}/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
  }
  return { text: result, removedLabels };
}

export interface EnforceAnchoredClaimsResult {
  descriptionHtml: string;
  productSections: ProductSection[];
  /** Nuevas entradas de claimsToAvoid generadas por esta pasada (el caller las fusiona con las del modelo). */
  addedClaimsToAvoid: string[];
}

/**
 * `supplierTextLower` debe ser el texto YA FILTRADO (sin las líneas
 * ignoradas de `textFilters.ts`) en minúsculas — un patrón "anclado" solo en
 * una línea de WhatsApp/oferta/etc. no cuenta como evidencia real.
 */
export function enforceAnchoredClaims(
  draft: { descriptionHtml: string; productSections: ProductSection[] },
  supplierTextLower: string
): EnforceAnchoredClaimsResult {
  const unanchored = GUARDED_CLAIMS.filter((c) => !hasMatch(supplierTextLower, c.pattern));
  if (unanchored.length === 0) {
    return { descriptionHtml: draft.descriptionHtml, productSections: draft.productSections, addedClaimsToAvoid: [] };
  }

  const claimsToAvoid: string[] = [];

  const descResult = stripGuardedClaims(draft.descriptionHtml, unanchored);
  for (const label of descResult.removedLabels) {
    claimsToAvoid.push(`${label}: el modelo lo mencionó en la descripción pero no aparece en el texto del proveedor — se removió.`);
  }

  const productSections = draft.productSections.map((section) => {
    switch (section.type) {
      case "usage":
      case "measurements":
      case "versatility": {
        if (!section.data.description) return section;
        const r = stripGuardedClaims(section.data.description, unanchored);
        for (const label of r.removedLabels) {
          claimsToAvoid.push(
            `${label}: el modelo lo mencionó en el bloque "${section.type}" pero no aparece en el texto del proveedor — se removió.`
          );
        }
        return { ...section, data: { ...section.data, description: r.text } };
      }
      case "benefits": {
        const items = section.data.items.map((item) => {
          const titleR = stripGuardedClaims(item.title, unanchored);
          const descR = stripGuardedClaims(item.description, unanchored);
          for (const label of [...titleR.removedLabels, ...descR.removedLabels]) {
            claimsToAvoid.push(
              `${label}: el modelo lo mencionó en una tarjeta de beneficios pero no aparece en el texto del proveedor — se removió.`
            );
          }
          return {
            ...item,
            title: titleR.text || item.title,
            description: descR.text || item.description,
          };
        });
        return { ...section, data: { ...section.data, items } };
      }
      default:
        // El generador de IA nunca produce otros tipos (ver generateAIDraft.ts),
        // pero si llegara uno, se deja intacto en vez de asumir su forma.
        return section;
    }
  });

  return {
    descriptionHtml: descResult.text,
    productSections,
    addedClaimsToAvoid: Array.from(new Set(claimsToAvoid)),
  };
}
