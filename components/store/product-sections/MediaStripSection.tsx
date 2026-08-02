"use client";

import { motion } from "framer-motion";

import type { MediaStripData } from "@/lib/product/sections/types";

import { SectionContainer } from "./shared/SectionContainer";

const ASPECT_CLASS: Record<MediaStripData["aspect"], string> = {
  "16/9": "aspect-[16/9]",
  "4/3": "aspect-[4/3]",
  "1/1": "aspect-square",
};

interface MediaStripSectionProps {
  data: MediaStripData;
}

export function MediaStripSection({ data }: MediaStripSectionProps) {
  if (!data.image_url) return null;

  const aspectClass = ASPECT_CLASS[data.aspect] ?? ASPECT_CLASS["16/9"];

  return (
    <SectionContainer bare>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.figure
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="overflow-hidden rounded-[var(--radius-lg)] border border-zinc-200 bg-zinc-100 shadow-[0_18px_40px_rgba(0,0,0,0.08)]"
        >
          <div className={`relative w-full overflow-hidden ${aspectClass}`}>
            {/* Uso <img> en vez de next/image porque los hosts son arbitrarios (admin pega URL). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.image_url}
              alt={data.alt ?? data.caption ?? ""}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
          {data.caption && (
            <figcaption className="px-4 py-3 text-center text-xs text-zinc-600 sm:text-sm">
              {data.caption}
            </figcaption>
          )}
        </motion.figure>
      </div>
    </SectionContainer>
  );
}
