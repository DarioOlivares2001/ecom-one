"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Clock } from "lucide-react";
import type { OfferCountdownData } from "@/lib/product/sections/types";
import { getCountdownRemaining, type CountdownRemaining } from "@/lib/product/sections/offerCountdown";
import { SectionContainer } from "./shared/SectionContainer";

interface OfferCountdownSectionProps {
  data: OfferCountdownData;
}

function Segment({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-[3.75rem] flex-1 flex-col items-center gap-1 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-2 py-3 text-white sm:min-w-[4.5rem] sm:py-4">
      <span className="text-2xl font-extrabold tabular-nums leading-none sm:text-3xl">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90 sm:text-xs">
        {label}
      </span>
    </div>
  );
}

/**
 * "Contador de oferta": cuenta regresiva real hacia `data.ends_at`. Solo
 * presentación — nunca cambia precio, descuentos ni disponibilidad. Nunca se
 * reinicia: una vez que `getCountdownRemaining` devuelve `null` (fecha
 * ausente, inválida o pasada) el componente deja de renderizar nada y el
 * intervalo se limpia; no hay ningún camino que lo vuelva a mostrar sin que
 * el admin configure una fecha futura nueva.
 */
export function OfferCountdownSection({ data }: OfferCountdownSectionProps) {
  const [remaining, setRemaining] = useState<CountdownRemaining | null>(() =>
    getCountdownRemaining(data.ends_at)
  );
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const next = getCountdownRemaining(data.ends_at);
    setRemaining(next);
    if (!next) return;

    const interval = window.setInterval(() => {
      setRemaining(getCountdownRemaining(data.ends_at));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [data.ends_at]);

  if (!remaining) return null;

  return (
    <SectionContainer bare>
      <div className="px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full rounded-[var(--radius-lg)] border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/[0.06] px-4 py-6 sm:px-8 sm:py-8"
        >
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:text-left">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
                <Clock className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-lg font-bold text-[var(--color-text)] sm:text-xl">
                  {data.heading || "Oferta por tiempo limitado"}
                </p>
                {data.message && (
                  <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{data.message}</p>
                )}
              </div>
            </div>

            <div className="flex w-full max-w-md items-center gap-2 sm:w-auto sm:gap-3">
              {remaining.days > 0 && <Segment value={remaining.days} label="días" />}
              <Segment value={remaining.hours} label="hrs" />
              <Segment value={remaining.minutes} label="min" />
              <Segment value={remaining.seconds} label="seg" />
            </div>
          </div>
        </motion.div>
      </div>
    </SectionContainer>
  );
}
