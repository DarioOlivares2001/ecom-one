"use client";

import type { VisualSequenceData } from "@/lib/product/sections/types";

import { SectionContainer } from "./shared/SectionContainer";

interface VisualSequenceSectionProps {
  data: VisualSequenceData;
}

/**
 * Secuencia vertical de creativos. Cada lámina ya trae su titular y copy
 * integrados en la imagen — este componente no agrega texto, tarjetas ni
 * captions, solo apila las imágenes en el orden configurado.
 */
export function VisualSequenceSection({ data }: VisualSequenceSectionProps) {
  const slides = (data.slides ?? []).filter((s) => !!s.image_url?.trim());
  if (slides.length === 0) return null;

  return (
    <SectionContainer bare>
      <div className="mx-auto max-w-2xl">
        {slides.map((slide, index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={index}
            src={slide.image_url}
            alt={slide.alt?.trim() || "Imagen del producto"}
            className="block w-full"
            loading={index === 0 ? "eager" : "lazy"}
            decoding="async"
          />
        ))}
      </div>
    </SectionContainer>
  );
}
