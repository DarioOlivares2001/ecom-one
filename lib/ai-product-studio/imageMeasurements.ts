/**
 * Validación, normalización y comparación de medidas detectadas por el
 * modelo DENTRO de imágenes (cotas impresas y legibles en un diagrama
 * técnico del proveedor, ej. "17 cm", "10,5 cm", "29 x 22 x 10 cm") — nunca
 * confía ciegamente en lo que el modelo reporta: cada valor se valida
 * contra un patrón real de medida antes de usarse en cualquier lado, y las
 * comparaciones (texto vs. imagen) son deterministas en servidor, no
 * delegadas al modelo.
 *
 * Puro — sin red, sin `server-only`, sin depender de `generateAIDraft.ts` —
 * así se puede probar de forma aislada. Ver `generateAIDraft.ts` para cómo
 * se conecta esto con el resto del borrador (bloque "measurements",
 * `detectedFacts`, portada de galería).
 */

const UNIT = "(?:cm|mm|m)";
const NUM = "\\d+(?:[.,]\\d+)?";

const SINGLE_DIMENSION_EXACT = new RegExp(`^${NUM}\\s*${UNIT}$`, "i");
const TRIPLE_DIMENSION_EXACT = new RegExp(`^${NUM}\\s*[x×]\\s*${NUM}\\s*[x×]\\s*${NUM}\\s*${UNIT}$`, "i");
const SINGLE_DIMENSION_SEARCH = new RegExp(`\\b${NUM}\\s*${UNIT}\\b`, "gi");
const TRIPLE_DIMENSION_SEARCH = new RegExp(`\\b${NUM}\\s*[x×]\\s*${NUM}\\s*[x×]\\s*${NUM}\\s*${UNIT}\\b`, "gi");
const TRIPLE_DECOMPOSE = new RegExp(`^(${NUM})\\s*[x×]\\s*(${NUM})\\s*[x×]\\s*(${NUM})\\s*(${UNIT})$`, "i");
const SINGLE_DECOMPOSE = new RegExp(`^(${NUM})\\s*(${UNIT})$`, "i");

/** ¿Es EXACTAMENTE una medida bien formada (ej. "17 cm" o "29 x 22 x 10 cm")? Nada de texto extra alrededor — nunca confía en que el modelo solo puso una medida ahí. */
export function isValidMeasurementToken(raw: string): boolean {
  const trimmed = raw.trim();
  return SINGLE_DIMENSION_EXACT.test(trimmed) || TRIPLE_DIMENSION_EXACT.test(trimmed);
}

/**
 * Filtra y deduplica una lista cruda de valores propuestos por el modelo:
 * descarta cualquier string que no sea una medida real bien formada, quita
 * duplicados exactos (mismo texto, sin distinguir mayúsculas) y limita a 6
 * valores. Nunca corrige ni completa un valor mal formado.
 */
export function sanitizeMeasurementValues(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed || !isValidMeasurementToken(trimmed)) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= 6) break;
  }
  return out;
}

interface DimensionToken {
  num: number;
  unit: string;
}

function decomposeToken(raw: string): DimensionToken[] {
  const trimmed = raw.trim().toLowerCase();
  const triple = trimmed.match(TRIPLE_DECOMPOSE);
  if (triple) {
    const unit = triple[4];
    return [triple[1], triple[2], triple[3]].map((n) => ({ num: Number(n.replace(",", ".")), unit }));
  }
  const single = trimmed.match(SINGLE_DECOMPOSE);
  if (single) {
    return [{ num: Number(single[1].replace(",", ".")), unit: single[2] }];
  }
  return [];
}

function tokenSetKey(tokens: DimensionToken[]): string {
  return Array.from(new Set(tokens.map((t) => `${t.num}${t.unit}`)))
    .sort()
    .join("|");
}

/**
 * Extrae todas las medidas (individuales, ej. "17 cm", y en formato
 * "N x N x N unidad") mencionadas en un texto libre — para comparar contra
 * lo detectado en una imagen. No modifica ni interpreta el texto, solo
 * encuentra los patrones ya establecidos de medida explícita.
 */
export function extractMeasurementTokensFromText(text: string): string[] {
  if (!text) return [];
  const triples = text.match(TRIPLE_DIMENSION_SEARCH) ?? [];
  const singles = text.match(SINGLE_DIMENSION_SEARCH) ?? [];
  return [...triples, ...singles];
}

/**
 * ¿El conjunto de medidas de `a` es EXACTAMENTE el mismo que el de `b`,
 * numéricamente (coma/punto y "x"/"×" no importan, ni el orden)? Vacío en
 * cualquiera de los dos lados nunca "coincide" — evita falsos positivos por
 * ausencia de datos en un lado.
 */
export function measurementSetsMatch(rawA: string[], rawB: string[]): boolean {
  const a = rawA.flatMap(decomposeToken);
  const b = rawB.flatMap(decomposeToken);
  if (a.length === 0 || b.length === 0) return false;
  return tokenSetKey(a) === tokenSetKey(b);
}

/**
 * Si la portada actual (primera URL) es una imagen técnica de medidas y hay
 * al menos otra imagen que NO lo es, intercambia esas dos posiciones — nunca
 * quita la imagen de medidas de la galería (sigue disponible más atrás),
 * nunca reordena nada más allá de ese único intercambio.
 */
export function demoteMeasurementCoverImage(
  urls: string[],
  measurementImageUrls: ReadonlySet<string>
): { urls: string[]; changed: boolean } {
  if (urls.length < 2) return { urls, changed: false };
  if (!measurementImageUrls.has(urls[0])) return { urls, changed: false };

  const swapIndex = urls.findIndex((u, i) => i > 0 && !measurementImageUrls.has(u));
  if (swapIndex === -1) return { urls, changed: false };

  const next = [...urls];
  [next[0], next[swapIndex]] = [next[swapIndex], next[0]];
  return { urls: next, changed: true };
}
