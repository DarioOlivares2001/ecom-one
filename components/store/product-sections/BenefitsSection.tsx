"use client";

import { motion } from "framer-motion";

import type { BenefitsData } from "@/lib/product/sections/types";

import { SectionContainer } from "./shared/SectionContainer";
import { getBenefitIcon } from "./shared/benefitIcons";

interface BenefitsSectionProps {
  data: BenefitsData;
}

export function BenefitsSection({ data }: BenefitsSectionProps) {
  if (!data.items?.length) return null;

  return (
    <SectionContainer heading={data.heading} eyebrow={data.heading ? undefined : "Beneficios"}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data.items.map((item, index) => {
          const Icon = getBenefitIcon(item.icon);
          return (
            <motion.article
              key={`${item.title}-${index}`}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.36, ease: "easeOut", delay: index * 0.04 }}
              whileHover={{ y: -2 }}
              className="group flex items-start gap-3 rounded-[var(--radius-md)] border border-zinc-200 bg-white px-4 py-4 shadow-[0_4px_14px_rgba(0,0,0,0.04)] transition-colors hover:border-zinc-300"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white shadow-sm">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug text-zinc-900">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-600 sm:text-[13px]">
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
