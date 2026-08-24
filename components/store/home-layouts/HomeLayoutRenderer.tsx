import type { ComponentType } from "react";
import { Hero } from "@/components/store/Hero";
import type { StorefrontThemeId } from "@/lib/store-settings/storefrontThemes";
import type { StoreSettingsView } from "@/lib/store-settings/getStoreSettings";
import type { HomeLayoutProps } from "./types";
import { ConversionHomeLayout } from "./ConversionHomeLayout";
import { WellnessHomeLayout } from "./WellnessHomeLayout";

const LAYOUTS: Record<StorefrontThemeId, ComponentType<HomeLayoutProps>> = {
  "conversion-general": ConversionHomeLayout,
  "wellness-supplements": WellnessHomeLayout,
};

interface HomeLayoutRendererProps extends HomeLayoutProps {
  theme: StorefrontThemeId;
  settings: StoreSettingsView;
}

/**
 * Único punto de decisión "qué tema estructural renderiza Home". El banner
 * (`Hero`) es igual en ambos temas — no depende de la estructura, solo del
 * banner configurado en /admin/configuracion — así que se renderiza acá una
 * sola vez, no duplicado por tema.
 */
export function HomeLayoutRenderer({ theme, settings, ...layoutProps }: HomeLayoutRendererProps) {
  const Layout = LAYOUTS[theme] ?? ConversionHomeLayout;
  return (
    <main>
      <Hero
        desktopBannerUrl={settings.hero_banner_desktop_url}
        mobileBannerUrl={settings.hero_banner_mobile_url}
        heroOverlayMode={settings.hero_overlay_mode}
        heroOverlayOpacity={settings.hero_overlay_opacity}
      />
      <Layout {...layoutProps} />
    </main>
  );
}
