"use client";

import { clsx } from "clsx";

type StickerOffersProps = {
  hasOffers: boolean;
  onClick: () => void;
};

export function StickerOffers({ hasOffers, onClick }: StickerOffersProps) {
  return (
    <>
      <style jsx global>{`
        @keyframes pulse-soft {
          0% {
            transform: rotate(-10deg) scale(1);
          }
          50% {
            transform: rotate(-10deg) scale(1.06);
          }
          100% {
            transform: rotate(-10deg) scale(1);
          }
        }
      `}</style>

      {/* Desktop / tablet: sticker lateral */}
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          "absolute left-0 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(0,0,0,0.24)] transition-all duration-250 hover:scale-105 hover:shadow-[0_14px_32px_rgba(0,0,0,0.3)] md:inline-flex",
          "bg-brand-gradient",
          hasOffers && "animate-[pulse-soft_2.5s_ease-in-out_infinite] hover:[animation-play-state:paused]"
        )}
        aria-label="Ver ofertas disponibles"
      >
        <span>Ofertas</span>
      </button>

      {/* Mobile: botón fijo inferior */}
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          "fixed bottom-24 left-1/2 z-[60] inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/96 px-4 py-2 text-sm font-semibold text-[var(--color-text)] shadow-[0_12px_28px_rgba(0,0,0,0.2)] backdrop-blur-sm transition-all duration-200 md:hidden",
          "hover:border-[var(--color-primary)]/35 hover:bg-[var(--color-background)]"
        )}
        aria-label="Ver ofertas disponibles"
      >
        <span>Ver ofertas</span>
      </button>
    </>
  );
}

