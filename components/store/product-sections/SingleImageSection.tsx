"use client";

import { motion } from "framer-motion";

import type { MeasurementsData, UsageData, VersatilityData } from "@/lib/product/sections/types";

import { SectionContainer } from "./shared/SectionContainer";

type SingleImageData = UsageData | MeasurementsData | VersatilityData;

interface SingleImageSectionProps {
  data: SingleImageData;
  /** Eyebrow por defecto cuando no hay `heading` (distingue Uso/Medidas/Versatilidad). */
  fallbackEyebrow: string;
}

/**
 * Renderer compartido por los bloques de una sola imagen principal ("Uso /
 * Cómo usar", "Medidas", "Versatilidad"). Si `image_url` viene vacío (nunca
 * se asignó, o la imagen se borró de la biblioteca) el bloque simplemente no
 * se renderiza — nunca rompe la ficha pública.
 */
export function SingleImageSection({ data, fallbackEyebrow }: SingleImageSectionProps) {
  const imageUrl = data.image_url?.trim();
  if (!imageUrl) return null;

  return (
    <SectionContainer heading={data.heading} eyebrow={data.heading ? undefined : fallbackEyebrow}>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="overflow-hidden rounded-[var(--radius-lg)] border border-zinc-200 bg-zinc-100 shadow-[0_14px_34px_rgba(0,0,0,0.06)]"
      >
        {/* Host arbitrario (biblioteca del producto en R2) — <img>, no next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={data.alt ?? data.heading ?? ""}
          className="block w-full"
          loading="lazy"
          decoding="async"
        />
      </motion.div>
    </SectionContainer>
  );
}
