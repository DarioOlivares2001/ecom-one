"use client";

import { motion } from "framer-motion";
import { Ruler } from "lucide-react";

import type { MeasurementsData, UsageData, VersatilityData } from "@/lib/product/sections/types";
import { extractExplicitDimensions } from "@/lib/product/sections/extractDimensions";

import { SectionContainer } from "./shared/SectionContainer";

type SingleImageData = UsageData | MeasurementsData | VersatilityData;

interface SingleImageSectionProps {
  type: "usage" | "measurements" | "versatility";
  data: SingleImageData;
  /** Eyebrow por defecto cuando no hay `heading` (distingue Uso/Medidas/Versatilidad). */
  fallbackEyebrow: string;
}

/**
 * "Secado vertical de prendas" describe una observación visual (cuelga la
 * ropa en vertical), no una promesa de resultado — pero el nombre puede
 * confundirse con una garantía de velocidad de secado. Se renombra solo en
 * la vista pública, sin tocar el dato guardado en Neon.
 */
const VERSATILITY_HEADING_RENAME: Record<string, string> = {
  "secado vertical de prendas": "Diseño vertical para colgar prendas",
};

/**
 * Renderer compartido por los bloques de una sola imagen principal ("Uso /
 * Cómo usar", "Medidas", "Versatilidad"). Si `image_url` viene vacío (nunca
 * se asignó, o la imagen se borró de la biblioteca) el bloque simplemente no
 * se renderiza — nunca rompe la ficha pública.
 */
export function SingleImageSection({ type, data, fallbackEyebrow }: SingleImageSectionProps) {
  const imageUrl = data.image_url?.trim();
  if (!imageUrl) return null;

  const description = data.description?.trim();
  const trimmedHeading = data.heading?.trim();
  const displayHeading =
    type === "versatility" && trimmedHeading
      ? (VERSATILITY_HEADING_RENAME[trimmedHeading.toLowerCase()] ?? data.heading)
      : data.heading;
  const dimensions =
    type === "measurements" && description ? extractExplicitDimensions(description) : null;

  return (
    <SectionContainer heading={displayHeading} eyebrow={displayHeading ? undefined : fallbackEyebrow}>
      {description && (
        <p className="mb-4 whitespace-pre-line text-sm leading-relaxed text-[var(--color-text-muted)] sm:text-base">
          {description}
        </p>
      )}
      {dimensions && (
        <div className="mb-4 inline-flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5">
          <Ruler className="h-4 w-4 shrink-0 text-[var(--color-primary)]" strokeWidth={2} />
          <div className="flex flex-col">
            <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Medidas plegada
            </span>
            <span className="text-sm font-bold text-[var(--color-text)]">{dimensions}</span>
          </div>
        </div>
      )}
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
          alt={data.alt ?? displayHeading ?? ""}
          className="block w-full"
          loading="lazy"
          decoding="async"
        />
      </motion.div>
    </SectionContainer>
  );
}
