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
    <div className="flex flex-col items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--color-text)] px-2.5 py-1.5 text-[var(--color-surface)] sm:px-3 sm:py-2">
      <span className="text-lg font-extrabold tabular-nums sm:text-xl">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[9px] font-medium uppercase tracking-wide opacity-80 sm:text-[10px]">
        {label}
      </span>
    </div>
  );
}

/**
 * "Contador de oferta": cuenta regresiva real hacia `data.ends_at`. Nunca se
 * reinicia — una vez que `getCountdownRemaining` devuelve `null` (fecha
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
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-5 text-center sm:flex-row sm:justify-between sm:text-left"
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
            <div>
              {data.heading && (
                <p className="text-sm font-bold text-[var(--color-text)]">{data.heading}</p>
              )}
              {data.message && (
                <p className="text-xs text-[var(--color-text-muted)]">{data.message}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {remaining.days > 0 && <Segment value={remaining.days} label="días" />}
            <Segment value={remaining.hours} label="hrs" />
            <Segment value={remaining.minutes} label="min" />
            <Segment value={remaining.seconds} label="seg" />
          </div>
        </motion.div>
      </div>
    </SectionContainer>
  );
}
