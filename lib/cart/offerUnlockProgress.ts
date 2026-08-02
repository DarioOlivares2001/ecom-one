/** Umbrales de subtotal (CLP) para niveles de oferta en el carrito. */
export const OFFER_UNLOCK_THRESHOLDS = [20_000, 30_000, 40_000] as const;

export type OfferUnlockState = {
  /** Progreso hacia el siguiente umbral (0–100). */
  progressPercent: number;
  /** Monto faltante hasta el siguiente nivel (0 si ya está en el máximo). */
  remainingToNext: number;
  /** Próximo umbral en pesos, o null si ya alcanzó el nivel premium. */
  nextThreshold: number | null;
  /** Subtotal >= último umbral. */
  isMaxUnlocked: boolean;
};

/**
 * Calcula progreso y saldo faltante para el siguiente nivel de ofertas.
 * Tramos: [0,t1) → t1, [t1,t2) → t2, [t2,t3) → t3, [t3,∞) completado.
 */
export function getOfferUnlockState(subtotal: number): OfferUnlockState {
  const s = Math.max(0, subtotal);
  const [t1, t2, t3] = OFFER_UNLOCK_THRESHOLDS;

  if (s >= t3) {
    return {
      progressPercent: 100,
      remainingToNext: 0,
      nextThreshold: null,
      isMaxUnlocked: true,
    };
  }

  if (s >= t2) {
    return {
      progressPercent: Math.min(100, ((s - t2) / (t3 - t2)) * 100),
      remainingToNext: Math.max(0, t3 - s),
      nextThreshold: t3,
      isMaxUnlocked: false,
    };
  }

  if (s >= t1) {
    return {
      progressPercent: Math.min(100, ((s - t1) / (t2 - t1)) * 100),
      remainingToNext: Math.max(0, t2 - s),
      nextThreshold: t2,
      isMaxUnlocked: false,
    };
  }

  return {
    progressPercent: t1 > 0 ? Math.min(100, (s / t1) * 100) : 100,
    remainingToNext: Math.max(0, t1 - s),
    nextThreshold: t1,
    isMaxUnlocked: false,
  };
}
