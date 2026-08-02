"use client";

import { useState, useMemo, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SlidersHorizontal, X, PackageOpen } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";
import { ProductCard } from "@/components/store/ProductCard";
import { ProductCardSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import type { Product } from "@/lib/supabase/types";
import { normalizeProductCategory, sortCategoriesForStore } from "@/lib/product/categories";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = "newest" | "price-asc" | "price-desc";
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Más nuevos" },
  { value: "price-asc", label: "Menor precio" },
  { value: "price-desc", label: "Mayor precio" },
];

// ─── Shared select style ──────────────────────────────────────────────────────

const selectCls =
  "h-9 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer";

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductsClient({ initialProducts }: { initialProducts: Product[] }) {
  const [mounted, setMounted] = useState(false);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  const categories = useMemo(
    () => {
      const unique = Array.from(
        new Set(
          initialProducts
            .map((p) => normalizeProductCategory(p.category))
            .filter(Boolean)
        )
      ) as string[];
      return sortCategoriesForStore(unique);
    },
    [initialProducts]
  );

  const displayed = useMemo(() => {
    let result = [...initialProducts];
    if (category) {
      result = result.filter((p) => normalizeProductCategory(p.category) === category);
    }
    if (sort === "price-asc") result.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") result.sort((a, b) => b.price - a.price);
    return result;
  }, [initialProducts, category, sort]);

  const activeCount = (category ? 1 : 0) + (sort !== "newest" ? 1 : 0);

  // ── Loading skeleton (before hydration) ──────────────────────────────────────
  if (!mounted) {
    return (
      <main className="mx-auto max-w-7xl px-3 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-2">
          <div className="h-9 w-64 animate-pulse rounded-lg bg-[var(--color-border)]" />
          <div className="h-4 w-24 animate-pulse rounded bg-[var(--color-border)]" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto max-w-7xl px-3 py-10 sm:px-6 lg:px-8">

        {/* ── Page header + filters ── */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl">
              Todos los productos
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {displayed.length}{" "}
              {displayed.length === 1 ? "producto" : "productos"}
            </p>
          </div>

          {/* Desktop filters */}
          <div className="hidden items-center gap-3 sm:flex">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={selectCls}
              aria-label="Filtrar por categoría"
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className={selectCls}
              aria-label="Ordenar productos"
            >
              {SORT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Mobile filter button */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-primary)] sm:hidden"
            aria-expanded={drawerOpen}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtrar
            {activeCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--color-primary)] px-1 text-[10px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Grid / empty state ── */}
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <PackageOpen
              className="h-14 w-14 text-[var(--color-text-muted)]"
              strokeWidth={1}
            />
            <div>
              <p className="font-semibold text-[var(--color-text)]">
                No hay productos disponibles
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Intenta con otra categoría u orden.
              </p>
            </div>
            <Link href="/">
              <Button variant="secondary">Volver al inicio</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {displayed.map((product, i) => (
              <ProductCard
                key={product.id}
                product={product}
                priority={i < 2}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Mobile filter drawer ── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Overlay */}
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setDrawerOpen(false)}
              aria-hidden
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-[var(--color-surface)] px-5 pb-10 pt-5 shadow-2xl"
              role="dialog"
              aria-modal
              aria-label="Filtros"
            >
              {/* Handle */}
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--color-border)]" />

              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-[var(--color-text)]">
                  Filtros
                </h2>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-full p-1.5 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
                  aria-label="Cerrar filtros"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Category pills */}
              <div className="mb-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                  Categoría
                </p>
                <div className="flex flex-wrap gap-2">
                  {["", ...categories].map((c) => (
                    <button
                      key={c || "all"}
                      onClick={() => setCategory(c)}
                      className={clsx(
                        "rounded-[var(--radius-full)] border px-4 py-1.5 text-sm font-medium transition-colors",
                        category === c
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                          : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-text)]"
                      )}
                    >
                      {c || "Todos"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort options */}
              <div className="mb-8">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                  Ordenar por
                </p>
                <div className="flex flex-col gap-2">
                  {SORT_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setSort(value)}
                      className={clsx(
                        "flex items-center justify-between rounded-[var(--radius-sm)] border px-4 py-3 text-left text-sm transition-colors",
                        sort === value
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 font-semibold text-[var(--color-primary)]"
                          : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]"
                      )}
                    >
                      {label}
                      {sort === value && (
                        <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <Button fullWidth onClick={() => setDrawerOpen(false)}>
                Ver {displayed.length}{" "}
                {displayed.length === 1 ? "producto" : "productos"}
              </Button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
