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

/**
 * Plantilla "Oferta del día": convierte una fecha suelta (`YYYY-MM-DD`) al
 * ISO 8601 de las 23:59:59 LOCALES de ese mismo día. Es solo una forma
 * rápida de rellenar `ends_at` — una vez calculado, se guarda como el mismo
 * timestamp fijo de siempre (sin campo especial, sin recurrencia): al pasar
 * esa hora, `getCountdownRemaining` devuelve `null` para siempre y el bloque
 * no vuelve a aparecer solo. `""` si `dateOnly` no tiene el formato esperado.
 */
export function endOfDayIso(dateOnly: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly.trim());
  if (!match) return "";
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 0);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}
