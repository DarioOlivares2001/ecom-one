/**
 * Extrae un texto de dimensiones explícitas (ej. "29 x 22 x 10 cm") de un
 * bloque de texto, si existe. Puro, sin dependencias — usado tanto por el
 * Estudio IA de Producto (`lib/ai-product-studio/specClaims.ts`, para no
 * inventar medidas) como por el renderer público de la ficha
 * (`SingleImageSection.tsx`, para destacar la medida real en una tarjeta
 * visual dentro del bloque "Medidas"). Nunca infiere ni redondea: solo
 * reconoce el patrón "N x N x N cm" tal como aparece en el texto de origen.
 */
export const DIMENSIONS_PATTERN_SOURCE = String.raw`\b\d+\s*[x×]\s*\d+\s*[x×]\s*\d+\s*cm\b`;

export function extractExplicitDimensions(text: string): string | null {
  const match = text.match(new RegExp(DIMENSIONS_PATTERN_SOURCE, "i"));
  return match ? match[0] : null;
}
