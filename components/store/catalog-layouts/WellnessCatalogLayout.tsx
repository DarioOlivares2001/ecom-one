"use client";

import Link from "next/link";
import { PackageOpen } from "lucide-react";
import { clsx } from "clsx";
import { ProductCard } from "@/components/store/ProductCard";
import { Button } from "@/components/ui/Button";
import { SORT_OPTIONS } from "./useProductCatalogFilters";
import type { CatalogLayoutProps } from "./types";

/**
 * Tema "Bienestar y suplementos" — catálogo editorial: filtro de categoría
 * siempre visible como chips (sin dropdown ni drawer oculto), grilla más
 * espaciosa (máximo 3 columnas). Misma lógica de filtro/orden que el tema
 * base (useProductCatalogFilters) — solo cambia la presentación.
 */
export function WellnessCatalogLayout({
  category,
  setCategory,
  sort,
  setSort,
  categories,
  displayed,
}: CatalogLayoutProps) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      {/* ── Page header ── */}
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl">
          Catálogo de bienestar
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {displayed.length} {displayed.length === 1 ? "producto" : "productos"}
        </p>
      </div>

      {/* ── Filtro de categoría, siempre visible ── */}
      {categories.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {["", ...categories].map((c) => (
            <button
              key={c || "all"}
              onClick={() => setCategory(c)}
              className={clsx(
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                category === c
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-text)]"
              )}
            >
              {c || "Todas"}
            </button>
          ))}
        </div>
      )}

      {/* ── Orden ── */}
      <div className="mb-8 flex items-center gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Ordenar
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          aria-label="Ordenar productos"
        >
          {SORT_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Grid / empty state ── */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <PackageOpen className="h-14 w-14 text-[var(--color-text-muted)]" strokeWidth={1} />
          <div>
            <p className="font-semibold text-[var(--color-text)]">No encontramos productos en esta categoría</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Prueba con otra categoría o vuelve a &quot;Todas&quot;.
            </p>
          </div>
          <Link href="/">
            <Button variant="secondary">Volver al inicio</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3">
          {displayed.map((product, i) => (
            <ProductCard key={product.id} product={product} priority={i < 2} />
          ))}
        </div>
      )}
    </main>
  );
}
