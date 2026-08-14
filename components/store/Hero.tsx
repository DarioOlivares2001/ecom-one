"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

const HERO_FALLBACK_BANNER = "";

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: [0.25, 0.1, 0.25, 1] as const },
});

type HeroProps = {
  desktopBannerUrl?: string | null;
  mobileBannerUrl?: string | null;
  heroOverlayMode?: "manual" | "auto" | null;
  heroOverlayOpacity?: number | null;
};

function sanitizeOverlayOpacity(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 60;
  if (value < 0 || value > 90) return 60;
  return value;
}

function buildManualOverlayGradient(opacityPercent: number): string {
  const factor = Math.max(0, Math.min(1, opacityPercent / 90));
  const a1 = (0.68 * factor).toFixed(2);
  const a2 = (0.42 * factor).toFixed(2);
  const a3 = (0.14 * factor).toFixed(2);
  return `linear-gradient(90deg, rgba(255,255,255,${a1}) 0%, rgba(255,255,255,${a2}) 38%, rgba(255,255,255,${a3}) 65%, rgba(255,255,255,0.00) 100%)`;
}

export function Hero({
  desktopBannerUrl,
  mobileBannerUrl,
  heroOverlayMode,
  heroOverlayOpacity,
}: HeroProps) {
  const desktopUrl = desktopBannerUrl?.trim() || HERO_FALLBACK_BANNER;
  const mobileUrl = mobileBannerUrl?.trim() || desktopUrl;
  const overlayMode = heroOverlayMode === "auto" ? "auto" : "manual";
  const overlayOpacity = sanitizeOverlayOpacity(heroOverlayOpacity);

  useEffect(() => {
    console.log("[hero] banner urls", { desktopUrl, mobileUrl });
  }, [desktopUrl, mobileUrl]);

  return (
    <section className="relative min-h-[780px] overflow-hidden md:min-h-[620px]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-[position:center_bottom] md:hidden"
        style={{ backgroundImage: `url(${mobileUrl})` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden bg-cover bg-[position:center_right] md:block"
        style={{ backgroundImage: `url(${desktopUrl})` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 md:hidden"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.48) 28%, rgba(255,255,255,0.16) 52%, rgba(255,255,255,0.00) 100%)",
        }}
      />
      {overlayMode === "manual" ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden md:block"
          style={{ background: buildManualOverlayGradient(overlayOpacity) }}
        />
      ) : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden md:block"
          style={{
            background:
              "linear-gradient(90deg, rgba(255,255,255,0.68) 0%, rgba(255,255,255,0.42) 38%, rgba(255,255,255,0.14) 65%, rgba(255,255,255,0.00) 100%)",
          }}
        />
      )}

      <div className="relative z-10 mx-auto flex min-h-[780px] max-w-7xl flex-col px-5 md:min-h-[620px] md:px-8 md:hidden">
        <div className="pt-16 text-center md:pt-20 md:text-left">
          <motion.p
            {...fadeUp(0.1)}
            className="mx-auto mb-4 inline-flex w-fit items-center rounded-full bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white shadow-lg ring-1 ring-white/30"
          >
            Productos seleccionados para ti
          </motion.p>

          <motion.h1
            {...fadeUp(0.2)}
            className="mx-auto mt-2 max-w-[340px] font-display text-[34px] font-bold leading-[1.05] tracking-tight text-[var(--color-text)]"
          >
            Descubre productos que hacen la diferencia
          </motion.h1>

          <motion.p
            {...fadeUp(0.3)}
            className="mx-auto mt-3 max-w-[320px] text-sm leading-relaxed text-[var(--color-text-muted)]"
          >
            Una selección renovada de artículos útiles, novedosos y con buen valor para tu día a día.
          </motion.p>
        </div>

        <div className="mt-auto mb-10 flex flex-col items-center gap-3 md:mt-6 md:mb-0 md:items-start">
          <motion.div {...fadeUp(0.5)} className="flex w-full flex-col items-center gap-3">
            <Link href="/productos" className="mx-auto w-full max-w-[300px]">
              <Button size="lg" fullWidth className="shadow-xl transition-transform hover:scale-[1.03]">
                Ver productos
              </Button>
            </Link>
            <Link href="/#novedades" className="mx-auto w-full max-w-[300px]">
              <Button
                size="lg"
                variant="ghost"
                fullWidth
                className="border border-[var(--color-border)] bg-white/85 text-[var(--color-text)] shadow-xl transition-transform hover:scale-[1.03] hover:bg-white"
              >
                Explorar novedades
              </Button>
            </Link>
          </motion.div>

          <motion.ul
            {...fadeUp(0.6)}
            className="mt-2 flex flex-wrap justify-center gap-2 text-xs text-[var(--color-text-muted)]"
          >
            <li className="rounded-full bg-white/85 px-3 py-1.5 text-xs shadow-sm">Compra segura</li>
            <li className="rounded-full bg-white/85 px-3 py-1.5 text-xs shadow-sm">Despacho a domicilio</li>
            <li className="rounded-full bg-white/85 px-3 py-1.5 text-xs shadow-sm">Atención cercana</li>
          </motion.ul>
        </div>
      </div>

      <div className="relative z-10 mx-auto hidden min-h-[620px] w-full max-w-7xl px-8 md:flex md:items-start md:justify-start md:pb-16 md:pt-20">
        <div className="max-w-xl">
          <motion.p
            {...fadeUp(0.1)}
            className="mb-4 inline-flex w-fit items-center rounded-full bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white shadow-lg ring-1 ring-white/30 md:text-sm"
          >
            Productos seleccionados para ti
          </motion.p>

          <motion.h1
            {...fadeUp(0.2)}
            className="mt-2 max-w-[560px] font-display text-[52px] font-bold leading-[1.05] tracking-tight text-[var(--color-text)]"
          >
            Descubre productos que hacen la diferencia
          </motion.h1>

          <motion.p
            {...fadeUp(0.35)}
            className="mt-3 max-w-[500px] text-sm leading-relaxed text-[var(--color-text-muted)] sm:text-base"
          >
            Una selección renovada de artículos útiles, novedosos y con buen valor para tu día a día.
          </motion.p>

          <motion.div {...fadeUp(0.5)} className="mt-5 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/productos" className="w-full sm:w-auto">
              <Button size="lg" fullWidth className="shadow-xl transition-transform hover:scale-[1.03]">
                Ver productos
              </Button>
            </Link>
            <Link href="/#novedades" className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="ghost"
                fullWidth
                className="border border-[var(--color-border)] bg-white/80 text-[var(--color-text)] shadow-xl transition-transform hover:scale-[1.03] hover:bg-white"
              >
                Explorar novedades
              </Button>
            </Link>
          </motion.div>
          <motion.ul {...fadeUp(0.65)} className="mt-6 grid gap-2.5 text-sm text-[var(--color-text-muted)] sm:grid-cols-3">
            <li className="rounded-xl border border-[var(--color-border)] bg-white/75 px-3 py-2 shadow-sm">Compra segura</li>
            <li className="rounded-xl border border-[var(--color-border)] bg-white/75 px-3 py-2 shadow-sm">Despacho a domicilio</li>
            <li className="rounded-xl border border-[var(--color-border)] bg-white/75 px-3 py-2 shadow-sm">Atención cercana</li>
          </motion.ul>
        </div>
      </div>
    </section>
  );
}
