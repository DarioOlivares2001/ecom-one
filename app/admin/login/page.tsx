import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginScreen } from "./AdminLoginScreen";
import { getAdminSessionFromCookies } from "@/lib/admin/session";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";
import { isAllowedImageSrc } from "@/lib/images/isAllowedImageSrc";

export const metadata: Metadata = {
  title: "Login Admin",
};

/**
 * Server Component: la única razón para tocar `store_settings` acá es
 * mostrar el nombre/logo de la tienda en el diseño — nunca se pasa el
 * objeto completo de `getStoreSettings()` (trae campos internos como
 * `meta_capi_access_token`, `contact_email`, config de envío, etc.) al
 * componente cliente. Solo dos props primitivos y ya saneados cruzan el
 * límite server/client: `storeName` (string, con el mismo fallback "Tienda"
 * que ya usa el resto del sitio) y `logoUrl` (string | null, validado con
 * `isAllowedImageSrc` — local/R2 únicamente, nunca una URL arbitraria).
 */
export default async function AdminLoginPage() {
  if (getAdminSessionFromCookies()) {
    redirect("/admin/dashboard");
  }

  const settings = await getStoreSettings();
  const storeName = settings.store_name.trim() || "Tienda";
  const logoUrl = isAllowedImageSrc(settings.logo_url) ? settings.logo_url : null;

  return <AdminLoginScreen storeName={storeName} logoUrl={logoUrl} />;
}

