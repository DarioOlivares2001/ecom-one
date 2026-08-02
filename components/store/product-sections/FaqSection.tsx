"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { FaqData } from "@/lib/product/sections/types";

import { SectionContainer } from "./shared/SectionContainer";

interface FaqSectionProps {
  data: FaqData;
}

export function FaqSection({ data }: FaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (!data.items?.length) return null;

  return (
    <SectionContainer
      heading={data.heading ?? "Preguntas frecuentes"}
      eyebrow={data.heading ? undefined : "FAQ"}
    >
      <div className="divide-y divide-zinc-200 overflow-hidden rounded-[var(--radius-lg)] border border-zinc-200 bg-white shadow-[0_10px_28px_rgba(0,0,0,0.05)]">
        {data.items.map((item, index) => {
          const open = openIndex === index;
          const panelId = `faq-panel-${index}`;
          const buttonId = `faq-button-${index}`;
          return (
            <div key={`${item.question}-${index}`}>
              <h3 className="m-0">
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(open ? null : index)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-zinc-50 sm:px-5"
                >
                  <span className="text-sm font-semibold leading-snug text-zinc-900 sm:text-base">
                    {item.question}
                  </span>
                  <motion.span
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700"
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden />
                  </motion.span>
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="whitespace-pre-line px-4 pb-5 pt-0 text-sm leading-relaxed text-zinc-700 sm:px-5">
                      {item.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </SectionContainer>
  );
}
