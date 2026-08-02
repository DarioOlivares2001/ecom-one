"use client";

import { useCallback, useEffect, useState } from "react";

const PROMO_BULLETS = [
  "Productos seleccionados para gatos y hogares más limpios",
  "Entrega rápida en Rancagua y alrededores",
  "Beneficios exclusivos al agregar productos al carrito",
  "Compra segura y atención directa por WhatsApp",
] as const;

/** Duración de cada frase (coincide con `--promo-cycle` en CSS) */
const ROTATE_MS = 5200;

/**
 * Barra de anuncios: frases que entran rápido desde la derecha, brillo al aparecer
 * y bullet; rotación cada ciclo.
 */
export function PromoTickerBar() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const advance = useCallback(() => {
    setActive((i) => (i + 1) % PROMO_BULLETS.length);
  }, []);

  useEffect(() => {
    if (paused) return undefined;
    const id = window.setInterval(advance, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused, advance]);

  const cycleStyle = {
    "--promo-cycle": `${ROTATE_MS}ms`,
  } as React.CSSProperties & Record<"--promo-cycle", string>;

  return (
    <div
      className="promo-ticker-bar sticky top-0 z-50 flex h-8 w-full items-center justify-center overflow-hidden border-b border-black/20 px-3 sm:px-6 pointer-events-none"
      style={cycleStyle}
      role="region"
      aria-label="Avisos de la tienda"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className="relative flex h-full w-full max-w-4xl cursor-pointer items-center justify-center overflow-hidden pointer-events-auto"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          key={active}
          className="promo-ticker-phrase absolute inset-x-0 flex items-center justify-center px-2"
        >
          <span className="promo-ticker-burst relative inline-flex max-w-full items-center justify-center gap-2 overflow-hidden rounded-sm py-0.5 text-center text-[11px] font-medium leading-tight tracking-wide text-white sm:text-xs">
            <span className="promo-ticker-shine" aria-hidden />
            <span className="promo-ticker-bullet relative z-[1] shrink-0 select-none text-white/75" aria-hidden>
              •
            </span>
            <span className="promo-ticker-phrase-text relative z-[1] min-w-0 max-w-full truncate sm:max-w-none sm:whitespace-normal sm:overflow-visible">
              {PROMO_BULLETS[active]}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
