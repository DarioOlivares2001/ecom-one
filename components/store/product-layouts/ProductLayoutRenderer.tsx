import type { ComponentType } from "react";
import type { StorefrontThemeId } from "@/lib/store-settings/storefrontThemes";
import type { ProductLayoutProps } from "./types";
import { ConversionProductLayout } from "./ConversionProductLayout";
import { WellnessProductLayout } from "./WellnessProductLayout";

const LAYOUTS: Record<StorefrontThemeId, ComponentType<ProductLayoutProps>> = {
  "conversion-general": ConversionProductLayout,
  "wellness-supplements": WellnessProductLayout,
};

interface ProductLayoutRendererProps extends ProductLayoutProps {
  theme: StorefrontThemeId;
}

/**
 * Único punto de decisión "qué tema estructural renderizar". El wrapper
 * `<main>` (ancho máximo + espacio inferior para la barra sticky de compra)
 * se aplica acá, igual para los 2 temas, para que ningún tema pueda romper
 * accidentalmente el despeje que necesita `StickyAddToCart`.
 */
export function ProductLayoutRenderer({ theme, ...layoutProps }: ProductLayoutRendererProps) {
  const Layout = LAYOUTS[theme] ?? ConversionProductLayout;
  return (
    <main className="mx-auto max-w-7xl py-8 pb-28 md:pb-8">
      <Layout {...layoutProps} />
    </main>
  );
}
