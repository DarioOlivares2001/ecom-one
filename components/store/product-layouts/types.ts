import type { RefObject } from "react";
import type { Product, ProductVariant, Review } from "@/lib/db/types";
import type { ProductUpsellSuggestion } from "@/lib/product/upsell";

/**
 * Contrato de datos que reciben TODOS los layouts estructurales
 * (components/store/product-layouts/*ProductLayout.tsx). El orquestador
 * (ProductClient.tsx) es dueño de todo el estado y la lógica comercial; cada
 * layout solo decide QUÉ mostrar y EN QUÉ ORDEN/composición, nunca duplica
 * cálculos de precio, stock, carrito ni reseñas.
 */

export interface ProductCommercialState {
  displayPrice: number;
  displayCompareAt: number | null;
  displayStock: number;
  hasOffer: boolean;
  discount: number;
  savedAmount: number;
  qty: number;
  setQty: (updater: (q: number) => number) => void;
  adding: boolean;
  handleAdd: () => void;
  mainCTARef: RefObject<HTMLButtonElement>;
  urgencyMessage: string | null;
}

export interface ProductVariantState {
  hasRealVariants: boolean;
  activeVariants: ProductVariant[];
  selectedRealVariant: ProductVariant | null;
  setSelectedVariantId: (id: string) => void;
  variantGroups: Record<string, string[]> | null;
  selectedVariants: Record<string, string>;
  setSelectedVariants: (
    updater: (prev: Record<string, string>) => Record<string, string>
  ) => void;
}

export interface ProductReviewsState {
  list: Review[];
  avgRating: number | null;
  featuredReview: Review | null;
  regularReviews: Review[];
  onWriteReview: () => void;
}

export interface ProductUpsellState {
  visible: ProductUpsellSuggestion[];
  addedSuggestionId: string | null;
  onAdd: (s: ProductUpsellSuggestion) => void;
}

export interface ProductLayoutProps {
  product: Product;
  images: string[];
  hasDescription: boolean;
  hasModularSections: boolean;
  commercial: ProductCommercialState;
  variants: ProductVariantState;
  reviews: ProductReviewsState;
  upsell: ProductUpsellState;
}
