import type { Metadata } from "next";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";
import { resolveStorefrontTheme } from "@/lib/store-settings/storefrontThemes";
import { resolveLandingBentoSections } from "@/lib/store/landing-home-catalog";
import { HomeLayoutRenderer } from "@/components/store/home-layouts/HomeLayoutRenderer";

export const metadata: Metadata = {
  title: "Tienda online",
  description: "Explora nuestro catálogo y compra con confianza: despacho rápido y checkout simple.",
};
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const settings = await getStoreSettings();
  const { starterItems, offerProducts, categories } = await resolveLandingBentoSections();
  const hasCatalog = starterItems.length > 0 || offerProducts.length > 0 || categories.length > 0;

  return (
    <HomeLayoutRenderer
      theme={resolveStorefrontTheme(settings.storefront_theme)}
      settings={settings}
      starterItems={starterItems}
      offerProducts={offerProducts}
      categories={categories}
      hasCatalog={hasCatalog}
    />
  );
}
