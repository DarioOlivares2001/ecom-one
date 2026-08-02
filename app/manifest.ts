import type { MetadataRoute } from "next";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";

export const dynamic = "force-dynamic";

/**
 * Manifest de PWA/Android, dinámico desde store_settings — mismo criterio
 * que los íconos en app/layout.tsx: nada hardcodeado, cada clon de la
 * tienda trae su propio nombre e ícono.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getStoreSettings();

  return {
    name: settings.store_name,
    short_name: settings.store_name,
    start_url: "/",
    display: "standalone",
    background_color: settings.background_color || "#ffffff",
    theme_color: settings.primary_color || "#000000",
    icons: settings.pwa_icon_512_url
      ? [
          {
            src: settings.pwa_icon_512_url,
            sizes: "512x512",
            type: "image/png",
          },
        ]
      : [],
  };
}
