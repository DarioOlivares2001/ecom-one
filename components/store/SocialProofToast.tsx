"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const CITIES = ["Santiago", "Rancagua", "Talca", "Concepción", "Valparaíso"];
const TIMES = ["hace 1 minuto", "hace 5 minutos", "hace 10 minutos", "hace 2 minutos"];

type Props = {
  products: string[];
};

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function nextDelayMs() {
  return Math.floor((8 + Math.random() * 7) * 1000); // 8-15s
}

export function SocialProofToast({ products }: Props) {
  const names = useMemo(
    () => products.map((p) => p.trim()).filter(Boolean).slice(0, 60),
    [products]
  );
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);
  const [visible, setVisible] = useState(false);
  const [payload, setPayload] = useState<{
    city: string;
    product: string;
    when: string;
  } | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || names.length === 0) return;
    setPayload({
      city: randomFrom(CITIES),
      product: randomFrom(names),
      when: randomFrom(TIMES),
    });
    setVisible(true);
    const hideTimer = window.setTimeout(() => setVisible(false), 4000);
    const rotateTimer = window.setTimeout(() => setTick((v) => v + 1), nextDelayMs());
    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(rotateTimer);
    };
  }, [mounted, tick, names]);

  if (!mounted || !payload) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-30 hidden md:block">
      <AnimatePresence mode="wait">
        {visible && (
          <motion.div
            key={`${tick}-${payload.city}-${payload.product}-${payload.when}`}
            initial={{ opacity: 0, y: 14, x: -8 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 10, x: -8 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="max-w-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]/96 px-3 py-2 text-xs shadow-[0_8px_20px_rgba(0,0,0,0.14)] backdrop-blur-sm"
            aria-live="polite"
          >
            <p className="leading-relaxed text-[var(--color-text)]">
              <span className="mr-1">🟢</span>
              Alguien en {payload.city} compró{" "}
              <span className="font-semibold text-[var(--color-text)]">{payload.product}</span>{" "}
              {payload.when}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

