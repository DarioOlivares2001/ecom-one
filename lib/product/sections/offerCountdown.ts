export type CountdownRemaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
};

/** `null` si `endsAt` está vacío o no es una fecha válida — nunca lanza. */
export function parseCountdownTarget(endsAt: string | undefined | null): Date | null {
  if (!endsAt || !endsAt.trim()) return null;
  const date = new Date(endsAt);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/**
 * Tiempo restante real hasta `endsAt`. `null` si la fecha falta, es
 * inválida, o ya pasó — el caller (OfferCountdownSection) no debe renderizar
 * nada en ese caso. Nunca "reinicia": una vez que `totalMs <= 0` queda `null`
 * para siempre en ese instante y los siguientes.
 */
export function getCountdownRemaining(
  endsAt: string | undefined | null,
  now: Date = new Date()
): CountdownRemaining | null {
  const target = parseCountdownTarget(endsAt);
  if (!target) return null;

  const totalMs = target.getTime() - now.getTime();
  if (totalMs <= 0) return null;

  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalMs,
  };
}

/** `true` solo si hay una fecha futura real configurada. */
export function isCountdownActive(
  data: { ends_at?: string },
  now: Date = new Date()
): boolean {
  return getCountdownRemaining(data.ends_at, now) !== null;
}
