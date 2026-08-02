"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { formatPrice } from "@/lib/utils/format";
import { Badge } from "@/components/ui/Badge";

export interface BentoItem {
  id: string;
  type: "product" | "category" | "featured";
  title: string;
  subtitle?: string;
  price?: number;
  compareAtPrice?: number;
  image?: string;
  href: string;
  badge?: string;
  /** Controls grid span. "large" spans 2 columns on desktop. */
  size?: "normal" | "large";
}

interface BentoGridProps {
  items: BentoItem[];
  title?: string;
}

function BentoCard({ item }: { item: BentoItem }) {
  const hasOffer =
    item.price !== undefined &&
    item.compareAtPrice !== undefined &&
    item.compareAtPrice > item.price;

  const discount = hasOffer
    ? Math.round((1 - item.price! / item.compareAtPrice!) * 100)
    : 0;

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={[
        "group relative overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-background)]",
        item.size === "large" ? "md:col-span-2" : "col-span-1",
        item.type === "featured" ? "min-h-[420px]" : "min-h-[280px]",
      ].join(" ")}
    >
      <Link href={item.href} className="absolute inset-0 z-10" aria-label={item.title} />

      {/* Background image */}
      {item.image ? (
        <Image
          src={item.image}
          alt={item.title}
          fill
          sizes={
            item.size === "large"
              ? "(max-width: 768px) 100vw, 66vw"
              : "(max-width: 768px) 100vw, 33vw"
          }
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 to-zinc-200" />
      )}

      {/* Gradient overlay for text legibility */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
      />

      {/* Badges — top left */}
      {(item.badge || hasOffer) && (
        <div className="absolute left-4 top-4 z-20 flex gap-2">
          {hasOffer && <Badge variant="danger">−{discount}%</Badge>}
          {item.badge && <Badge variant="default">{item.badge}</Badge>}
        </div>
      )}

      {/* Content — bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-5">
        {item.subtitle && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/60">
            {item.subtitle}
          </p>
        )}
        <p className="font-display text-xl font-bold leading-snug text-white sm:text-2xl">
          {item.title}
        </p>

        <div className="mt-3 flex items-center justify-between">
          {item.price !== undefined ? (
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold text-white">
                {formatPrice(item.price)}
              </span>
              {hasOffer && (
                <span className="text-sm text-white/50 line-through">
                  {formatPrice(item.compareAtPrice!)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm font-medium text-white/70">
              Ver colección
            </span>
          )}

          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-colors group-hover:bg-white/30">
            <ArrowRight className="h-4 w-4 text-white" />
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function BentoGrid({ items, title }: BentoGridProps) {
  if (items.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {title && (
        <h2 className="mb-8 font-display text-3xl font-bold text-[var(--color-text)] sm:text-4xl">
          {title}
        </h2>
      )}

      {/*
        Grid layout (desktop, 3 columns):
        Row 1: [normal][normal][normal]   — tres celdas iguales
        Row 2: [large (span-2)  ][normal] — bento asimétrico
        Mobile: single column stack
      */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 sm:gap-5">
        {items.map((item) => (
          <BentoCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
