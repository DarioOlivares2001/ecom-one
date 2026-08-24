import type { Metadata } from "next";
import "./globals.css";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";
import { getPublicSiteUrl } from "@/lib/site-url";
import { FONT_VARIABLE_CLASSNAME } from "@/lib/fonts/registry";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  return {
    title: {
      default: settings.store_name,
      template: `%s | ${settings.store_name}`,
    },
    description: settings.store_tagline || "La mejor experiencia de compra online del país.",
    metadataBase: new URL(getPublicSiteUrl()),
    // Dinámico desde store_settings (subido en /admin/configuracion), no un
    // archivo estático — cada clon de la tienda tiene su propio favicon.
    // Si no hay nada configurado todavía, no se emite ningún ícono.
    icons: {
      ...(settings.favicon_url
        ? { icon: [{ url: settings.favicon_url, sizes: "32x32", type: "image/png" }] }
        : {}),
      ...(settings.apple_icon_url
        ? { apple: [{ url: settings.apple_icon_url, sizes: "180x180", type: "image/png" }] }
        : {}),
    },
  };
}

/**
 * Las variables CSS del tema de la tienda (`--color-*`/`--brand-*`) NO se
 * inyectan acá: `<body>` envuelve tanto el storefront como `/admin/*`, y
 * `/admin/configuracion` en particular usa esas mismas variables en sus
 * propios inputs — un preset oscuro terminaría recoloreando la UI de admin.
 * En vez de eso, `app/(store)/layout.tsx` las aplica en un wrapper que solo
 * envuelve las rutas de tienda (ver ese archivo).
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${FONT_VARIABLE_CLASSNAME} antialiased`}>{children}</body>
    </html>
  );
}
