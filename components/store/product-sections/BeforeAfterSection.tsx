"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronsLeftRight } from "lucide-react";

import type { BeforeAfterData } from "@/lib/product/sections/types";

import { SectionContainer } from "./shared/SectionContainer";

interface BeforeAfterSectionProps {
  data: BeforeAfterData;
}

const STEP = 2;

/**
 * Comparador de imágenes real: una imagen "después" de base y una "antes"
 * recortada con `clip-path` según la posición del divisor. El recorte se
 * aplica sobre la propia imagen (mismo tamaño que el contenedor) — nunca se
 * reescala ni deforma, solo se revela/oculta.
 */
export function BeforeAfterSection({ data }: BeforeAfterSectionProps) {
  const beforeUrl = data.before_image_url?.trim() ?? "";
  const afterUrl = data.after_image_url?.trim() ?? "";

  const [pct, setPct] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const raw = ((clientX - rect.left) / rect.width) * 100;
    setPct(Math.min(100, Math.max(0, raw)));
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft") {
      setPct((p) => Math.max(0, p - STEP));
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      setPct((p) => Math.min(100, p + STEP));
      e.preventDefault();
    } else if (e.key === "Home") {
      setPct(0);
      e.preventDefault();
    } else if (e.key === "End") {
      setPct(100);
      e.preventDefault();
    }
  }

  if (!beforeUrl || !afterUrl) return null;

  const beforeLabel = data.before_title?.trim() || "Antes";
  const afterLabel = data.after_title?.trim() || "Después";

  return (
    <SectionContainer heading={data.heading} eyebrow={data.heading ? undefined : "Comparativa"}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.42, ease: "easeOut" }}
        ref={containerRef}
        className="relative aspect-[4/3] w-full touch-none select-none overflow-hidden rounded-[var(--radius-lg)] border border-zinc-200 bg-zinc-100 shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
      >
        {/* Después — capa base, siempre completa */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={afterUrl}
          alt={afterLabel}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          draggable={false}
          loading="lazy"
          decoding="async"
        />

        {/* Antes — mismo tamaño, recortado con clip-path según el divisor */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl}
          alt={beforeLabel}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
          draggable={false}
          loading="lazy"
          decoding="async"
        />

        {/* Labels discretos */}
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
          {beforeLabel}
        </span>
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
          {afterLabel}
        </span>

        {/* Línea divisora */}
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
          style={{ left: `${pct}%` }}
        />

        {/* Manilla — arrastrable con mouse/touch (Pointer Events) y con teclado (flechas/Home/End) */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Deslizar para comparar antes y después"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          className="absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          style={{ left: `${pct}%` }}
        >
          <ChevronsLeftRight className="h-4 w-4" aria-hidden />
        </div>
      </motion.div>
    </SectionContainer>
  );
}
