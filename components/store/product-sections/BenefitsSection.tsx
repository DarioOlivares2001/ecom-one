"use client";

import { motion } from "framer-motion";

import type { BenefitsData } from "@/lib/product/sections/types";

import { SectionContainer } from "./shared/SectionContainer";
import { getBenefitIcon } from "./shared/benefitIcons";
import { getBenefitAccentClassName } from "./shared/benefitAccents";

interface BenefitsSectionProps {
  data: BenefitsData;
}

export function BenefitsSection({ data }: BenefitsSectionProps) {
  if (!data.items?.length) return null;

  const imageUrl = data.image_url?.trim();
  const description = data.description?.trim();

  return (
    <SectionContainer heading={data.heading} eyebrow={data.heading ? undefined : "Beneficios"}>
      {description && (
        <p className="mb-4 whitespace-pre-line text-sm leading-relaxed text-[var(--color-text-muted)] sm:text-base">
          {description}
        </p>
      )}
      {imageUrl && (
        <div className="mb-4 overflow-hidden rounded-[var(--radius-lg)] border border-zinc-200 bg-zinc-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={data.alt ?? data.heading ?? ""}
            className="block w-full"
            loading="lazy"
            decoding="async"
          />
        </div>
      )}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-3">
        {data.items.map((item, index) => {
          const Icon = getBenefitIcon(item.icon);
          const accentClassName = getBenefitAccentClassName(index);
          return (
            <motion.article
              key={`${item.title}-${index}`}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.36, ease: "easeOut", delay: index * 0.04 }}
              whileHover={{ y: -2 }}
              className="group flex items-start gap-3.5 rounded-[var(--radius-md)] border border-zinc-200 bg-white px-4 py-5 shadow-[0_4px_14px_rgba(0,0,0,0.04)] transition-colors hover:border-zinc-300 sm:gap-3 sm:py-4"
            >
              <span
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm sm:h-9 sm:w-9 ${accentClassName}`}
              >
                <Icon className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold leading-snug text-zinc-900 sm:text-sm">
                  {item.title}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">
                  {item.description}
                </p>
              </div>
            </motion.article>
          );
        })}
      </div>
    </SectionContainer>
  );
}
