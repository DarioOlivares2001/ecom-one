"use client";

import { ProductCardSkeleton } from "@/components/ui/Skeleton";
import type { Product } from "@/lib/db/types";
import { useProductCatalogFilters } from "@/components/store/catalog-layouts/useProductCatalogFilters";
import { CatalogLayoutRenderer } from "@/components/store/catalog-layouts/CatalogLayoutRenderer";
import { resolveStorefrontTheme } from "@/lib/store-settings/storefrontThemes";

interface ProductsClientProps {
  initialProducts: Product[];
  /** Tema estructural resuelto en el servidor — nunca colores. */
  storefrontTheme?: string;
}

/**
 * Orquestador del catálogo: dueño del estado real (filtro, orden, drawer vía
 * useProductCatalogFilters). No decide presentación — eso lo hace
 * CatalogLayoutRenderer según storefrontTheme.
 */
export function ProductsClient({ initialProducts, storefrontTheme }: ProductsClientProps) {
  const filters = useProductCatalogFilters(initialProducts);

  // ── Loading skeleton (antes de hidratar, igual en cualquier tema) ──
  if (!filters.mounted) {
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

  return <CatalogLayoutRenderer theme={resolveStorefrontTheme(storefrontTheme)} {...filters} />;
}
