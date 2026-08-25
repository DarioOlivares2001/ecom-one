/**
 * Paleta rotativa de acentos para las tarjetas del bloque "Beneficios" —
 * pura y determinista: el mismo índice de tarjeta siempre da el mismo
 * acento, sin importar qué icono eligió el admin (eso no cambia, solo la
 * presentación del círculo). Los 4 colores viven como variables CSS
 * globales (styles/tokens.css, --benefit-accent-1..4) para que sean
 * theme-aware por arquitectura — cualquier tema/preset actual (incluidos
 * conversion-general y wellness-supplements) cae de forma segura en el
 * mismo fallback global si no define uno propio.
 */

export const BENEFIT_ACCENT_COUNT = 4;

const BENEFIT_ACCENT_CLASSES = [
  "bg-[var(--benefit-accent-1)]",
  "bg-[var(--benefit-accent-2)]",
  "bg-[var(--benefit-accent-3)]",
  "bg-[var(--benefit-accent-4)]",
] as const;

/**
 * Índice de acento (0–3) para una tarjeta según su posición. Determinista:
 * mismo `cardIndex` -> mismo resultado siempre. Nunca lanza — índices
 * negativos o no finitos caen al primer acento.
 */
export function getBenefitAccentIndex(cardIndex: number): number {
  if (!Number.isFinite(cardIndex) || cardIndex < 0) return 0;
  return Math.floor(cardIndex) % BENEFIT_ACCENT_COUNT;
}

/** Clase Tailwind (`bg-[var(--benefit-accent-N)]`) para el círculo del icono de esa tarjeta. */
export function getBenefitAccentClassName(cardIndex: number): string {
  return BENEFIT_ACCENT_CLASSES[getBenefitAccentIndex(cardIndex)];
}
