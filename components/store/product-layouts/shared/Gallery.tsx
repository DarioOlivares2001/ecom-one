"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import { clsx } from "clsx";

const fadeVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const count = images.length;
  const multiple = count > 1;

  function goTo(index: number) {
    if (index === active) return;
    setActive(index);
  }

  function navigate(dir: -1 | 1) {
    setActive((prev) => (prev + dir + count) % count);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 28) navigate(delta > 0 ? 1 : -1);
    touchStartX.current = null;
  }

  return (
    <div className="flex flex-col gap-3 -mx-4 sm:-mx-6 lg:mx-0">
      {/* ── Main image ── */}
      <div
        className={clsx(
          "group relative aspect-square w-full touch-pan-y overflow-hidden bg-white sm:bg-[var(--color-background)]",
          "sm:rounded-[var(--radius-lg)]"
        )}
        onTouchStart={multiple ? handleTouchStart : undefined}
        onTouchEnd={multiple ? handleTouchEnd : undefined}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {count > 0 ? (
            <motion.div
              key={active}
              variants={fadeVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              <Image
                src={images[active]}
                alt={`${name} — imagen ${active + 1}`}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-contain p-2 sm:p-0 sm:object-cover transition-transform duration-500 ease-out sm:group-hover:scale-[1.03]"
                priority
              />
            </motion.div>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ShoppingBag className="h-16 w-16 text-[var(--color-border)]" strokeWidth={1} />
            </div>
          )}
        </AnimatePresence>

        {/* ── Arrows — hidden on mobile until hover; always visible mobile ── */}
        {multiple && (
          <>
            <button
              onClick={() => navigate(-1)}
              aria-label="Imagen anterior"
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-zinc-900 shadow-sm backdrop-blur-sm transition-all active:bg-white lg:opacity-0 lg:group-hover:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate(1)}
              aria-label="Imagen siguiente"
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-zinc-900 shadow-sm backdrop-blur-sm transition-all active:bg-white lg:opacity-0 lg:group-hover:opacity-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Counter pill — mobile only */}
            <div className="lg:hidden absolute bottom-3 right-3 z-10 rounded-full bg-black/50 px-2.5 py-0.5 text-[11px] font-medium text-white">
              {active + 1} / {count}
            </div>
          </>
        )}
      </div>

      {/* ── Thumbnails — max 5 visible, scroll if more ── */}
      {multiple && (
        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 sm:px-6 lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Ver imagen ${i + 1}`}
              aria-current={active === i ? "true" : undefined}
              className={clsx(
                "relative h-16 w-16 shrink-0 snap-start overflow-hidden rounded-[var(--radius-sm)] border-2 transition-all duration-150",
                active === i
                  ? "border-zinc-900 opacity-100"
                  : "border-transparent opacity-50 hover:opacity-80 hover:border-zinc-300"
              )}
            >
              <Image src={src} alt={`${name} miniatura ${i + 1}`} fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
