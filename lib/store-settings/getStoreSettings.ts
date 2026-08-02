import { createAdminClient } from "@/lib/supabase/admin";
import type { StoreSettings } from "@/lib/supabase/types";

export interface StoreSettingsView {
  store_name: string;
  store_tagline: string;
  logo_url: string;
  logo_square_url: string;
  favicon_url: string;
  /** 180x180, para apple-touch-icon. Generado junto a favicon_url desde la misma imagen subida. */
  apple_icon_url: string;
  /** 512x512, referenciado por app/manifest.ts (instalación PWA/Android). */
  pwa_icon_512_url: string;
  brand_text_color: string;
  navbar_background_color: string;
  navbar_text_color: string;
  footer_background_color: string;
  footer_text_color: string;
  primary_color: string;
  accent_color: string;
  background_color: string;
  surface_color: string;
  text_color: string;
  text_muted_color: string;
  border_color: string;
  theme_preset: string;
  branding_mode: "logo" | "text" | "logo_and_text";
  logo_size_desktop: number;
  logo_size_mobile: number;
  brand_text_scale: number;
  navbar_brand_position: "left" | "center" | "right";
  navbar_menu_position: "left" | "center" | "right";
  font_heading: string;
  font_body: string;
  theme_manual_override: boolean;
  support_whatsapp: string;
  contact_email: string;
  support_instagram: string;
  support_tiktok: string;
  hero_banner_desktop_url: string;
  hero_banner_mobile_url: string;
  hero_overlay_mode: "manual" | "auto";
  hero_overlay_opacity: number;
  /** Pedido por WhatsApp desde el carrito (usa support_whatsapp como número). */
  enable_whatsapp_checkout: boolean;
  /** Offset que se suma a order_number para generar el display_code (SO + 8 dígitos). */
  order_number_offset: number;
  /** Costo de envío en CLP. Fuente de verdad para cliente y servidor (recalculateCheckoutOrder). */
  shipping_cost_clp: number;
  /** Umbral de subtotal (CLP) desde el cual el envío es gratis. */
  shipping_free_threshold_clp: number;
  /** Botón flotante de WhatsApp (contacto general), independiente de enable_whatsapp_checkout. */
  enable_whatsapp_fab: boolean;
  meta_pixel_id: string;
  /** Secreto — solo se lee en servidor (lib/pixel/capi.ts). Nunca se manda al bundle del cliente. */
  meta_capi_access_token: string;
  meta_pixel_enabled: boolean;
  /** Opcional, solo mientras se prueba en Meta Events Manager. */
  meta_test_event_code: string;
  /** Microsoft Clarity (mapas de calor + grabaciones). Sin secreto: el Project ID no es sensible. */
  clarity_project_id: string;
  clarity_enabled: boolean;
}

export const DEFAULT_STORE_SETTINGS: StoreSettingsView = {
  store_name: "PonkyBonk",
  store_tagline: "Todo para gatos felices",
  logo_url: "",
  logo_square_url: "",
  favicon_url: "",
  apple_icon_url: "",
  pwa_icon_512_url: "",
  brand_text_color: "#111111",
  navbar_background_color: "#FFFFFF",
  navbar_text_color: "#111111",
  footer_background_color: "#111111",
  footer_text_color: "#FFFFFF",
  primary_color: "#6D28D9",
  accent_color: "#F472B6",
  background_color: "#FAFAFA",
  surface_color: "#FFFFFF",
  text_color: "#111111",
  text_muted_color: "#6B7280",
  border_color: "#E5E7EB",
  theme_preset: "pets_purple_pink",
  branding_mode: "logo_and_text",
  logo_size_desktop: 32,
  logo_size_mobile: 28,
  brand_text_scale: 1,
  navbar_brand_position: "left",
  navbar_menu_position: "center",
  font_heading: "Space Grotesk",
  font_body: "Inter",
  theme_manual_override: false,
  support_whatsapp: "56900000000",
  contact_email: "",
  support_instagram: "https://instagram.com/ponkybonk",
  support_tiktok: "https://tiktok.com/@ponkybonk",
  hero_banner_desktop_url: "",
  hero_banner_mobile_url: "",
  hero_overlay_mode: "manual",
  hero_overlay_opacity: 60,
  enable_whatsapp_checkout: false,
  order_number_offset: 0,
  shipping_cost_clp: 3_990,
  shipping_free_threshold_clp: 30_000,
  enable_whatsapp_fab: true,
  meta_pixel_id: "",
  meta_capi_access_token: "",
  meta_pixel_enabled: false,
  meta_test_event_code: "",
  clarity_project_id: "",
  clarity_enabled: false,
};

function normalizeSettings(row: StoreSettings | null): StoreSettingsView {
  if (!row) return DEFAULT_STORE_SETTINGS;

  const asPos = (value: string | null | undefined): "left" | "center" | "right" => {
    if (value === "left" || value === "center" || value === "right") return value;
    return "left";
  };
  const asBrandingMode = (
    value: string | null | undefined
  ): "logo" | "text" | "logo_and_text" => {
    if (value === "logo" || value === "text" || value === "logo_and_text") return value;
    return "logo_and_text";
  };
  const asPositiveNumber = (
    value: number | string | null | undefined,
    fallback: number
  ) => {
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : Number.NaN;
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return fallback;
  };
  const asHeroOverlayOpacity = (
    value: number | string | null | undefined,
    fallback: number
  ): number => {
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : Number.NaN;
    if (!Number.isFinite(parsed)) return fallback;
    if (parsed < 0 || parsed > 90) return fallback;
    return Math.round(parsed / 5) * 5;
  };
  const asHeroOverlayMode = (value: unknown): "manual" | "auto" => {
    return value === "auto" ? "auto" : "manual";
  };

  /** PostgREST/JSON pueden devolver boolean, string o null. */
  const asBoolean = (value: unknown, fallback: boolean): boolean => {
    if (value === true || value === "true" || value === "t" || value === "1" || value === 1)
      return true;
    if (value === false || value === "false" || value === "f" || value === "0" || value === 0)
      return false;
    return fallback;
  };
  const asNonNegativeInt = (value: unknown, fallback: number): number => {
    const parsed = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.floor(parsed);
  };

  return {
    store_name: row.store_name ?? DEFAULT_STORE_SETTINGS.store_name,
    store_tagline: row.store_tagline ?? DEFAULT_STORE_SETTINGS.store_tagline,
    logo_url: row.logo_url ?? DEFAULT_STORE_SETTINGS.logo_url,
    logo_square_url: row.logo_square_url ?? DEFAULT_STORE_SETTINGS.logo_square_url,
    favicon_url: row.favicon_url ?? DEFAULT_STORE_SETTINGS.favicon_url,
    apple_icon_url:
      (row as Record<string, unknown>).apple_icon_url?.toString?.() ?? DEFAULT_STORE_SETTINGS.apple_icon_url,
    pwa_icon_512_url:
      (row as Record<string, unknown>).pwa_icon_512_url?.toString?.() ?? DEFAULT_STORE_SETTINGS.pwa_icon_512_url,
    brand_text_color: row.brand_text_color ?? row.primary_color ?? DEFAULT_STORE_SETTINGS.brand_text_color,
    navbar_background_color:
      row.navbar_background_color ??
      row.surface_color ??
      DEFAULT_STORE_SETTINGS.navbar_background_color,
    navbar_text_color:
      row.navbar_text_color ?? row.text_color ?? DEFAULT_STORE_SETTINGS.navbar_text_color,
    footer_background_color:
      row.footer_background_color ?? DEFAULT_STORE_SETTINGS.footer_background_color,
    footer_text_color: row.footer_text_color ?? DEFAULT_STORE_SETTINGS.footer_text_color,
    primary_color: row.primary_color ?? DEFAULT_STORE_SETTINGS.primary_color,
    accent_color: row.accent_color ?? DEFAULT_STORE_SETTINGS.accent_color,
    background_color: row.background_color ?? DEFAULT_STORE_SETTINGS.background_color,
    surface_color: row.surface_color ?? DEFAULT_STORE_SETTINGS.surface_color,
    text_color: row.text_color ?? DEFAULT_STORE_SETTINGS.text_color,
    text_muted_color: row.text_muted_color ?? DEFAULT_STORE_SETTINGS.text_muted_color,
    border_color: row.border_color ?? DEFAULT_STORE_SETTINGS.border_color,
    theme_preset: row.theme_preset ?? DEFAULT_STORE_SETTINGS.theme_preset,
    branding_mode: asBrandingMode(row.branding_mode),
    logo_size_desktop: asPositiveNumber(
      row.logo_size_desktop,
      DEFAULT_STORE_SETTINGS.logo_size_desktop
    ),
    logo_size_mobile: asPositiveNumber(
      row.logo_size_mobile,
      DEFAULT_STORE_SETTINGS.logo_size_mobile
    ),
    brand_text_scale: asPositiveNumber(
      row.brand_text_scale,
      DEFAULT_STORE_SETTINGS.brand_text_scale
    ),
    navbar_brand_position: asPos(row.navbar_brand_position),
    navbar_menu_position: asPos(row.navbar_menu_position),
    font_heading: row.font_heading ?? DEFAULT_STORE_SETTINGS.font_heading,
    font_body: row.font_body ?? DEFAULT_STORE_SETTINGS.font_body,
    theme_manual_override: row.theme_manual_override ?? DEFAULT_STORE_SETTINGS.theme_manual_override,
    support_whatsapp: row.support_whatsapp ?? DEFAULT_STORE_SETTINGS.support_whatsapp,
    contact_email:
      (row as Record<string, unknown>).contact_email?.toString?.() ??
      DEFAULT_STORE_SETTINGS.contact_email,
    support_instagram: row.support_instagram ?? DEFAULT_STORE_SETTINGS.support_instagram,
    support_tiktok: row.support_tiktok ?? DEFAULT_STORE_SETTINGS.support_tiktok,
    hero_banner_desktop_url:
      (row as Record<string, unknown>).hero_banner_desktop_url?.toString?.() ??
      (row as Record<string, unknown>).banner_desktop_url?.toString?.() ??
      DEFAULT_STORE_SETTINGS.hero_banner_desktop_url,
    hero_banner_mobile_url:
      (row as Record<string, unknown>).hero_banner_mobile_url?.toString?.() ??
      (row as Record<string, unknown>).banner_mobile_url?.toString?.() ??
      DEFAULT_STORE_SETTINGS.hero_banner_mobile_url,
    hero_overlay_mode: asHeroOverlayMode((row as Record<string, unknown>).hero_overlay_mode),
    hero_overlay_opacity: asHeroOverlayOpacity(
      (row as Record<string, unknown>).hero_overlay_opacity as number | string | null | undefined,
      DEFAULT_STORE_SETTINGS.hero_overlay_opacity
    ),
    enable_whatsapp_checkout: asBoolean(
      (row as Record<string, unknown>).enable_whatsapp_checkout,
      DEFAULT_STORE_SETTINGS.enable_whatsapp_checkout
    ),
    order_number_offset: asNonNegativeInt(
      (row as Record<string, unknown>).order_number_offset,
      DEFAULT_STORE_SETTINGS.order_number_offset
    ),
    shipping_cost_clp: asNonNegativeInt(
      (row as Record<string, unknown>).shipping_cost_clp,
      DEFAULT_STORE_SETTINGS.shipping_cost_clp
    ),
    shipping_free_threshold_clp: asNonNegativeInt(
      (row as Record<string, unknown>).shipping_free_threshold_clp,
      DEFAULT_STORE_SETTINGS.shipping_free_threshold_clp
    ),
    enable_whatsapp_fab: asBoolean(
      (row as Record<string, unknown>).enable_whatsapp_fab,
      DEFAULT_STORE_SETTINGS.enable_whatsapp_fab
    ),
    meta_pixel_id: (row as Record<string, unknown>).meta_pixel_id?.toString?.() ?? DEFAULT_STORE_SETTINGS.meta_pixel_id,
    meta_capi_access_token:
      (row as Record<string, unknown>).meta_capi_access_token?.toString?.() ??
      DEFAULT_STORE_SETTINGS.meta_capi_access_token,
    meta_pixel_enabled: asBoolean(
      (row as Record<string, unknown>).meta_pixel_enabled,
      DEFAULT_STORE_SETTINGS.meta_pixel_enabled
    ),
    meta_test_event_code:
      (row as Record<string, unknown>).meta_test_event_code?.toString?.() ??
      DEFAULT_STORE_SETTINGS.meta_test_event_code,
    clarity_project_id:
      (row as Record<string, unknown>).clarity_project_id?.toString?.() ??
      DEFAULT_STORE_SETTINGS.clarity_project_id,
    clarity_enabled: asBoolean(
      (row as Record<string, unknown>).clarity_enabled,
      DEFAULT_STORE_SETTINGS.clarity_enabled
    ),
  };
}

export async function getStoreSettings(): Promise<StoreSettingsView> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (createAdminClient() as any)
      .from("store_settings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[store_settings] Error leyendo configuración:", error.message);
      return DEFAULT_STORE_SETTINGS;
    }

    return normalizeSettings((data as StoreSettings | null) ?? null);
  } catch (error) {
    console.error("[store_settings] Excepción leyendo configuración:", error);
    return DEFAULT_STORE_SETTINGS;
  }
}
