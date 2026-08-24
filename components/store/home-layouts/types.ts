import type { BentoItem } from "@/components/store/BentoGrid";
import type { Product } from "@/lib/db/types";

/**
 * Contrato de datos que reciben los layouts de Home
 * (ConversionHomeLayout/WellnessHomeLayout). Los datos son 100% reales
 * (mismo catálogo, mismas categorías, mismas ofertas) — cada layout solo
 * decide composición, copy de encabezados y énfasis visual, nunca inventa
 * productos ni datos.
 */
export interface HomeLayoutProps {
  starterItems: BentoItem[];
  offerProducts: Product[];
  categories: string[];
  hasCatalog: boolean;
}
