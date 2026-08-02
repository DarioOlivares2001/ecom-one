"use client";

import { motion } from "framer-motion";
import { Quote, Star } from "lucide-react";

import type { TestimonialItem, TestimonialsData } from "@/lib/product/sections/types";

import { SectionContainer } from "./shared/SectionContainer";

interface TestimonialsSectionProps {
  data: TestimonialsData;
}

export function TestimonialsSection({ data }: TestimonialsSectionProps) {
  if (!data.items?.length) return null;

  return (
    <SectionContainer
      heading={data.heading ?? "Lo que dicen quienes ya lo probaron"}
      eyebrow={data.heading ? undefined : "Testimonios"}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((item, index) => (
          <TestimonialCard key={`${item.name}-${index}`} item={item} index={index} />
        ))}
      </div>
    </SectionContainer>
  );
}

interface TestimonialCardProps {
  item: TestimonialItem;
  index: number;
}

function TestimonialCard({ item, index }: TestimonialCardProps) {
  const initials =
    item.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";

  const rating = item.rating && item.rating > 0 ? item.rating : null;
  const photo = item.photo_url && item.photo_url.length > 0 ? item.photo_url : null;

  return (
    <motion.figure
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.36, ease: "easeOut", delay: index * 0.04 }}
      whileHover={{ y: -3 }}
      className="relative flex h-full flex-col rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-5 shadow-[0_8px_22px_rgba(0,0,0,0.05)] transition-colors hover:border-zinc-300"
    >
      <Quote
        className="absolute right-4 top-4 h-5 w-5 text-zinc-200"
        aria-hidden
      />

      <div className="flex items-center gap-3">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={item.name}
            className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white shadow"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white shadow">
            {initials}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-900">{item.name}</p>
          <p className="truncate text-xs text-zinc-500">
            {[item.city, item.date_label].filter(Boolean).join(" · ") || "Cliente verificada"}
          </p>
        </div>
      </div>

      {rating !== null && (
        <div className="mt-3 flex items-center gap-0.5" aria-label={`${rating} de 5 estrellas`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-3.5 w-3.5 ${
                i < rating ? "fill-amber-400 text-amber-400" : "text-zinc-300"
              }`}
              aria-hidden
            />
          ))}
        </div>
      )}

      <blockquote className="mt-3 whitespace-pre-line text-sm leading-relaxed text-zinc-700">
        {item.comment}
      </blockquote>
    </motion.figure>
  );
}
