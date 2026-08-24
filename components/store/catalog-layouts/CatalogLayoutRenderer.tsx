import type { ComponentType } from "react";
import type { StorefrontThemeId } from "@/lib/store-settings/storefrontThemes";
import type { CatalogLayoutProps } from "./types";
import { ConversionCatalogLayout } from "./ConversionCatalogLayout";
import { WellnessCatalogLayout } from "./WellnessCatalogLayout";

const LAYOUTS: Record<StorefrontThemeId, ComponentType<CatalogLayoutProps>> = {
  "conversion-general": ConversionCatalogLayout,
  "wellness-supplements": WellnessCatalogLayout,
};

interface CatalogLayoutRendererProps extends CatalogLayoutProps {
  theme: StorefrontThemeId;
}

/** Único punto de decisión "qué tema estructural renderiza el catálogo". */
export function CatalogLayoutRenderer({ theme, ...filters }: CatalogLayoutRendererProps) {
  const Layout = LAYOUTS[theme] ?? ConversionCatalogLayout;
  return <Layout {...filters} />;
}
