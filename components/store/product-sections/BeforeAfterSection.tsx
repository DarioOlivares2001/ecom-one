"use client";

import { motion } from "framer-motion";

import type { BeforeAfterData } from "@/lib/product/sections/types";

import { SectionContainer } from "./shared/SectionContainer";

interface BeforeAfterSectionProps {
  data: BeforeAfterData;
}

interface SideCardProps {
  variant: "before" | "after";
  title?: string;
  description?: string;
  imageUrl?: string;
  index: number;
}

function hasContent(
  title?: string,
  description?: string,
  imageUrl?: string,
): boolean {
  return Boolean(
    (title && title.trim()) ||
      (description && description.trim()) ||
      (imageUrl && imageUrl.trim()),
  );
}

const VARIANT_STYLES = {
  before: {
    badgeBg: "bg-rose-100",
    badgeText: "text-rose-700",
    border: "border-rose-200",
    accent: "bg-rose-50",
    ring: "shadow-[0_10px_30px_rgba(244,63,94,0.08)]",
    label: "Antes",
  },
  after: {
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-700",
    border: "border-emerald-200",
    accent: "bg-emerald-50",
    ring: "shadow-[0_10px_30px_rgba(16,185,129,0.10)]",
    label: "Después",
  },
} as const;

function SideCard({
  variant,
  title,
  description,
  imageUrl,
  index,
}: SideCardProps) {
  const v = VARIANT_STYLES[variant];
  const displayTitle = title?.trim() || v.label;
  const safeImage = imageUrl?.trim() ?? "";

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.42, ease: "easeOut", delay: index * 0.08 }}
      className={`group flex flex-col overflow-hidden rounded-[var(--radius-lg)] border ${v.border} bg-white ${v.ring}`}
    >
      {/* Header con badge */}
      <header className={`flex items-center gap-2 px-4 py-3 ${v.accent}`}>
        <span
          className={`inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-extrabold uppercase tracking-wider ${v.badgeBg} ${v.badgeText}`}
        >
          {v.label}
        </span>
        <p className="truncate text-sm font-semibold text-zinc-900">
          {displayTitle}
        </p>
      </header>

      {/* Imagen opcional */}
      {safeImage && (
        <div className="relative w-full overflow-hidden bg-zinc-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={safeImage}
            alt={`${v.label}: ${displayTitle}`}
            className="block h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            style={{ aspectRatio: "4 / 3" }}
            loading="lazy"
            decoding="async"
          />
        </div>
      )}

      {/* Descripción */}
      {description?.trim() && (
        <div className="px-4 py-3.5 sm:px-5 sm:py-4">
          <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700 sm:text-[15px]">
            {description.trim()}
          </p>
        </div>
      )}
    </motion.article>
  );
}

export function BeforeAfterSection({ data }: BeforeAfterSectionProps) {
  const beforeHas = hasContent(
    data.before_title,
    data.before_description,
    data.before_image_url,
  );
  const afterHas = hasContent(
    data.after_title,
    data.after_description,
    data.after_image_url,
  );

  // Sin contenido alguno => no renderizar (evita tarjetas vacías).
  if (!beforeHas && !afterHas) return null;

  const layout = data.layout ?? "side_by_side";
  const gridCls =
    layout === "stacked"
      ? "grid grid-cols-1 gap-4 sm:gap-5"
      : "grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2";

  return (
    <SectionContainer
      heading={data.heading}
      eyebrow={data.heading ? undefined : "Comparativa"}
    >
      <div className={gridCls}>
        {beforeHas && (
          <SideCard
            variant="before"
            title={data.before_title}
            description={data.before_description}
            imageUrl={data.before_image_url}
            index={0}
          />
        )}
        {afterHas && (
          <SideCard
            variant="after"
            title={data.after_title}
            description={data.after_description}
            imageUrl={data.after_image_url}
            index={1}
          />
        )}
      </div>
    </SectionContainer>
  );
}
