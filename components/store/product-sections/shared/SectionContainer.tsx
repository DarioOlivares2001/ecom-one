"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface SectionContainerProps {
  heading?: string;
  eyebrow?: string;
  children: ReactNode;
  /** Si es true se omite el wrapper del max-w/padding para usos custom. */
  bare?: boolean;
}

/**
 * Envoltorio común para los bloques modulares de la ficha de producto.
 * Aporta el max-width, padding lateral y, opcionalmente, un encabezado.
 */
export function SectionContainer({
  heading,
  eyebrow,
  children,
  bare = false,
}: SectionContainerProps) {
  // Sin margen vertical propio: la separación entre bloques la controla el
  // `gap` del contenedor en `ProductSectionsRenderer` (ver ese archivo).
  if (bare) {
    return <section>{children}</section>;
  }

  return (
    <section className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
      {(eyebrow || heading) && (
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.42, ease: "easeOut" }}
          className="mb-3"
        >
          {eyebrow && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
              {eyebrow}
            </p>
          )}
          {heading && (
            <h2 className="font-display text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
              {heading}
            </h2>
          )}
        </motion.header>
      )}
      {children}
    </section>
  );
}
