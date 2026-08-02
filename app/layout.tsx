import type { Metadata } from "next";
import "./globals.css";
import { buildThemeCssProperties } from "@/lib/store-settings/buildThemeCssProperties";
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const settingsPromise = getStoreSettings();

  return (
    <html lang="es">
      <BodyWithTheme settingsPromise={settingsPromise}>{children}</BodyWithTheme>
    </html>
  );
}

async function BodyWithTheme({
  settingsPromise,
  children,
}: {
  settingsPromise: ReturnType<typeof getStoreSettings>;
  children: React.ReactNode;
}) {
  const settings = await settingsPromise;
  const themeVars = buildThemeCssProperties(settings);

  return (
    <body style={themeVars} className={`${FONT_VARIABLE_CLASSNAME} antialiased`}>
      {children}
    </body>
  );
}
