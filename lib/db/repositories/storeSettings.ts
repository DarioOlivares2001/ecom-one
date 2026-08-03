import "server-only";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { storeSettings } from "@/lib/db/schema";
import type { StoreSettings } from "@/lib/db/types";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Id fijo y conocido de la única fila de configuración. Usarlo como target de
 * `ON CONFLICT` es lo que permite que el insert-o-actualiza sea una única
 * sentencia atómica en Postgres (un solo round-trip, sin ventana de carrera
 * entre "verificar si existe" y "escribir"), a diferencia del patrón anterior
 * de hacer un SELECT y luego decidir INSERT o UPDATE en el código de la app.
 * `uq_store_settings_singleton` (índice único sobre la expresión `(true)`,
 * ver migración 0001) sigue existiendo como segunda barrera a nivel de BD:
 * ninguna fila con otro id podría coexistir con esta de todos modos.
 */
export const STORE_SETTINGS_SINGLETON_ID = "00000000-0000-0000-0000-000000000001";

type StoreSettingsRow = typeof storeSettings.$inferSelect;

function mapStoreSettings(row: StoreSettingsRow): StoreSettings {
  return {
    id: row.id,
    store_name: row.storeName,
    store_tagline: row.storeTagline,
    logo_url: row.logoUrl,
    logo_square_url: row.logoSquareUrl,
    favicon_url: row.faviconUrl,
    apple_icon_url: row.appleIconUrl,
    pwa_icon_512_url: row.pwaIcon512Url,
    brand_text_color: row.brandTextColor,
    navbar_background_color: row.navbarBackgroundColor,
    navbar_text_color: row.navbarTextColor,
    footer_background_color: row.footerBackgroundColor,
    footer_text_color: row.footerTextColor,
    primary_color: row.primaryColor,
    accent_color: row.accentColor,
    background_color: row.backgroundColor,
    surface_color: row.surfaceColor,
    text_color: row.textColor,
    text_muted_color: row.textMutedColor,
    border_color: row.borderColor,
    theme_preset: row.themePreset,
    branding_mode: row.brandingMode,
    logo_size_desktop: row.logoSizeDesktop,
    logo_size_mobile: row.logoSizeMobile,
    brand_text_scale: Number(row.brandTextScale),
    navbar_brand_position: row.navbarBrandPosition,
    navbar_menu_position: row.navbarMenuPosition,
    font_heading: row.fontHeading,
    font_body: row.fontBody,
    theme_manual_override: row.themeManualOverride,
    support_whatsapp: row.supportWhatsapp,
    contact_email: row.contactEmail,
    support_instagram: row.supportInstagram,
    support_tiktok: row.supportTiktok,
    enable_whatsapp_checkout: row.enableWhatsappCheckout,
    hero_banner_desktop_url: row.heroBannerDesktopUrl,
    hero_banner_mobile_url: row.heroBannerMobileUrl,
    hero_overlay_opacity: row.heroOverlayOpacity,
    hero_overlay_mode: row.heroOverlayMode,
    order_number_offset: row.orderNumberOffset,
    shipping_cost_clp: row.shippingCostClp,
    shipping_free_threshold_clp: row.shippingFreeThresholdClp,
    enable_whatsapp_fab: row.enableWhatsappFab,
    meta_pixel_id: row.metaPixelId,
    meta_capi_access_token: row.metaCapiAccessToken,
    meta_pixel_enabled: row.metaPixelEnabled,
    meta_test_event_code: row.metaTestEventCode,
    clarity_project_id: row.clarityProjectId,
    clarity_enabled: row.clarityEnabled,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/** Única fila de configuración, identificada por su id fijo. null si nunca se creó. */
export async function getStoreSettingsRow(): Promise<StoreSettings | null> {
  const rows = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.id, STORE_SETTINGS_SINGLETON_ID))
    .limit(1);

  return rows[0] ? mapStoreSettings(rows[0]) : null;
}

/** Solo para diagnóstico/dev: cuenta cuántas filas existen realmente en la tabla. */
export async function countStoreSettingsRows(): Promise<number> {
  const rows = await db.select({ id: storeSettings.id }).from(storeSettings);
  return rows.length;
}

export interface StoreSettingsUpsertInput {
  store_name?: string;
  store_tagline?: string | null;
  logo_url?: string | null;
  logo_square_url?: string | null;
  favicon_url?: string | null;
  apple_icon_url?: string | null;
  pwa_icon_512_url?: string | null;
  brand_text_color?: string;
  navbar_background_color?: string;
  navbar_text_color?: string;
  footer_background_color?: string;
  footer_text_color?: string;
  primary_color?: string;
  accent_color?: string;
  background_color?: string;
  surface_color?: string;
  text_color?: string;
  text_muted_color?: string;
  border_color?: string;
  theme_preset?: string;
  branding_mode?: string;
  logo_size_desktop?: number;
  logo_size_mobile?: number;
  brand_text_scale?: number;
  navbar_brand_position?: string;
  navbar_menu_position?: string;
  font_heading?: string;
  font_body?: string;
  theme_manual_override?: boolean;
  support_whatsapp?: string | null;
  contact_email?: string | null;
  support_instagram?: string | null;
  support_tiktok?: string | null;
  enable_whatsapp_checkout?: boolean;
  hero_banner_desktop_url?: string | null;
  hero_banner_mobile_url?: string | null;
  hero_overlay_opacity?: number | null;
  hero_overlay_mode?: string | null;
  order_number_offset?: number | null;
  shipping_cost_clp?: number;
  shipping_free_threshold_clp?: number;
  enable_whatsapp_fab?: boolean;
  meta_pixel_id?: string | null;
  meta_capi_access_token?: string | null;
  meta_pixel_enabled?: boolean;
  meta_test_event_code?: string | null;
  clarity_project_id?: string | null;
  clarity_enabled?: boolean;
}

function toDrizzleValues(input: StoreSettingsUpsertInput) {
  const values: Record<string, unknown> = {};
  if (input.store_name !== undefined) values.storeName = input.store_name;
  if (input.store_tagline !== undefined) values.storeTagline = input.store_tagline;
  if (input.logo_url !== undefined) values.logoUrl = input.logo_url;
  if (input.logo_square_url !== undefined) values.logoSquareUrl = input.logo_square_url;
  if (input.favicon_url !== undefined) values.faviconUrl = input.favicon_url;
  if (input.apple_icon_url !== undefined) values.appleIconUrl = input.apple_icon_url;
  if (input.pwa_icon_512_url !== undefined) values.pwaIcon512Url = input.pwa_icon_512_url;
  if (input.brand_text_color !== undefined) values.brandTextColor = input.brand_text_color;
  if (input.navbar_background_color !== undefined)
    values.navbarBackgroundColor = input.navbar_background_color;
  if (input.navbar_text_color !== undefined) values.navbarTextColor = input.navbar_text_color;
  if (input.footer_background_color !== undefined)
    values.footerBackgroundColor = input.footer_background_color;
  if (input.footer_text_color !== undefined) values.footerTextColor = input.footer_text_color;
  if (input.primary_color !== undefined) values.primaryColor = input.primary_color;
  if (input.accent_color !== undefined) values.accentColor = input.accent_color;
  if (input.background_color !== undefined) values.backgroundColor = input.background_color;
  if (input.surface_color !== undefined) values.surfaceColor = input.surface_color;
  if (input.text_color !== undefined) values.textColor = input.text_color;
  if (input.text_muted_color !== undefined) values.textMutedColor = input.text_muted_color;
  if (input.border_color !== undefined) values.borderColor = input.border_color;
  if (input.theme_preset !== undefined) values.themePreset = input.theme_preset;
  if (input.branding_mode !== undefined) values.brandingMode = input.branding_mode;
  if (input.logo_size_desktop !== undefined) values.logoSizeDesktop = input.logo_size_desktop;
  if (input.logo_size_mobile !== undefined) values.logoSizeMobile = input.logo_size_mobile;
  if (input.brand_text_scale !== undefined)
    values.brandTextScale = String(input.brand_text_scale);
  if (input.navbar_brand_position !== undefined)
    values.navbarBrandPosition = input.navbar_brand_position;
  if (input.navbar_menu_position !== undefined)
    values.navbarMenuPosition = input.navbar_menu_position;
  if (input.font_heading !== undefined) values.fontHeading = input.font_heading;
  if (input.font_body !== undefined) values.fontBody = input.font_body;
  if (input.theme_manual_override !== undefined)
    values.themeManualOverride = input.theme_manual_override;
  if (input.support_whatsapp !== undefined) values.supportWhatsapp = input.support_whatsapp;
  if (input.contact_email !== undefined) values.contactEmail = input.contact_email;
  if (input.support_instagram !== undefined) values.supportInstagram = input.support_instagram;
  if (input.support_tiktok !== undefined) values.supportTiktok = input.support_tiktok;
  if (input.enable_whatsapp_checkout !== undefined)
    values.enableWhatsappCheckout = input.enable_whatsapp_checkout;
  if (input.hero_banner_desktop_url !== undefined)
    values.heroBannerDesktopUrl = input.hero_banner_desktop_url;
  if (input.hero_banner_mobile_url !== undefined)
    values.heroBannerMobileUrl = input.hero_banner_mobile_url;
  if (input.hero_overlay_opacity !== undefined)
    values.heroOverlayOpacity = input.hero_overlay_opacity;
  if (input.hero_overlay_mode !== undefined) values.heroOverlayMode = input.hero_overlay_mode;
  if (input.order_number_offset !== undefined)
    values.orderNumberOffset = input.order_number_offset;
  if (input.shipping_cost_clp !== undefined) values.shippingCostClp = input.shipping_cost_clp;
  if (input.shipping_free_threshold_clp !== undefined)
    values.shippingFreeThresholdClp = input.shipping_free_threshold_clp;
  if (input.enable_whatsapp_fab !== undefined)
    values.enableWhatsappFab = input.enable_whatsapp_fab;
  if (input.meta_pixel_id !== undefined) values.metaPixelId = input.meta_pixel_id;
  if (input.meta_capi_access_token !== undefined)
    values.metaCapiAccessToken = input.meta_capi_access_token;
  if (input.meta_pixel_enabled !== undefined) values.metaPixelEnabled = input.meta_pixel_enabled;
  if (input.meta_test_event_code !== undefined)
    values.metaTestEventCode = input.meta_test_event_code;
  if (input.clarity_project_id !== undefined) values.clarityProjectId = input.clarity_project_id;
  if (input.clarity_enabled !== undefined) values.clarityEnabled = input.clarity_enabled;
  return values;
}

/**
 * Guardado explícito del admin (`/admin/configuracion` y las páginas de
 * marketing): crea la fila si no existe, o **sobrescribe intencionalmente**
 * la existente si ya hay una. Es la única función de este archivo que debe
 * pisar valores ya guardados — se usa exclusivamente desde una acción
 * disparada por un submit real del admin, nunca desde una lectura.
 *
 * Atómico: una sola sentencia `INSERT ... ON CONFLICT (id) DO UPDATE`, sin el
 * round-trip previo de "SELECT para ver si existe, después decido INSERT o
 * UPDATE" (que dejaba una ventana de carrera entre dos requests concurrentes).
 */
export async function upsertStoreSettings(
  input: StoreSettingsUpsertInput
): Promise<StoreSettings> {
  const values = toDrizzleValues(input);

  const [row] = await db
    .insert(storeSettings)
    .values({ id: STORE_SETTINGS_SINGLETON_ID, ...values })
    .onConflictDoUpdate({
      target: storeSettings.id,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();

  if (isDev) {
    console.log(`[store_settings] guardado por admin (id=${row.id})`);
  }

  return mapStoreSettings(row);
}

/**
 * Crea la fila con valores neutros **solo si todavía no existe ninguna**.
 * A diferencia de `upsertStoreSettings`, esta función NUNCA debe sobrescribir
 * una fila existente — por eso usa `DO NOTHING` en vez de `DO UPDATE`: si el
 * conflicto ocurre (la fila ya existía, con cualquier valor, incluidos los
 * que el admin ya haya guardado), el INSERT simplemente no hace nada y se
 * relee la fila tal cual está, intacta.
 */
export async function ensureStoreSettingsRowExists(
  neutralDefaults: StoreSettingsUpsertInput
): Promise<{ row: StoreSettings; created: boolean }> {
  const values = toDrizzleValues(neutralDefaults);

  const inserted = await db
    .insert(storeSettings)
    .values({ id: STORE_SETTINGS_SINGLETON_ID, ...values })
    .onConflictDoNothing({ target: storeSettings.id })
    .returning();

  if (inserted[0]) {
    if (isDev) {
      console.log(`[store_settings] fila neutra creada por primera vez (id=${inserted[0].id})`);
    }
    return { row: mapStoreSettings(inserted[0]), created: true };
  }

  // Conflicto: ya existía. La leemos tal cual — nunca se toca su contenido.
  const existing = await getStoreSettingsRow();
  if (!existing) {
    throw new Error(
      "store_settings: el insert inicial no se aplicó (ya existía) pero no se pudo releer la fila."
    );
  }
  return { row: existing, created: false };
}
