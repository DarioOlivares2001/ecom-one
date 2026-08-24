"use client";

import { useState, useMemo, useEffect } from "react";
import type { Product } from "@/lib/db/types";
import { normalizeProductCategory, sortCategoriesForStore } from "@/lib/product/categories";

export type SortKey = "newest" | "price-asc" | "price-desc";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Más nuevos" },
  { value: "price-asc", label: "Menor precio" },
  { value: "price-desc", label: "Mayor precio" },
];

export interface ProductCatalogFilters {
  mounted: boolean;
  category: string;
  setCategory: (category: string) => void;
  sort: SortKey;
  setSort: (sort: SortKey) => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  categories: string[];
  displayed: Product[];
  activeCount: number;
}

/**
 * Estado y lógica real del catálogo (filtro por categoría, orden, drawer
 * móvil) — la MISMA para cualquier tema estructural. Los layouts
 * (ConversionCatalogLayout/WellnessCatalogLayout) solo deciden cómo
 * presentar este mismo estado, nunca duplican la lógica de filtrado/orden.
 */
export function useProductCatalogFilters(initialProducts: Product[]): ProductCatalogFilters {
  const [mounted, setMounted] = useState(false);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const initialCategory = new URLSearchParams(window.location.search).get("categoria");
    if (initialCategory) setCategory(initialCategory);
  }, []);

  const categories = useMemo(() => {
    const unique = Array.from(
      new Set(initialProducts.map((p) => normalizeProductCategory(p.category)).filter(Boolean))
    ) as string[];
    return sortCategoriesForStore(unique);
  }, [initialProducts]);

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

  return {
    mounted,
    category,
    setCategory,
    sort,
    setSort,
    drawerOpen,
    setDrawerOpen,
    categories,
    displayed,
    activeCount,
  };
}
