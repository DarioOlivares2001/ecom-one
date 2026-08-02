import { boolean, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const storeSettings = pgTable("store_settings", {
  id: uuid("id").defaultRandom().primaryKey(),

  storeName: text("store_name").notNull().default("Mi Tienda"),
  storeTagline: text("store_tagline"),

  logoUrl: text("logo_url"),
  logoSquareUrl: text("logo_square_url"),
  faviconUrl: text("favicon_url"),
  appleIconUrl: text("apple_icon_url"),
  pwaIcon512Url: text("pwa_icon_512_url"),

  brandTextColor: text("brand_text_color").notNull().default("#111111"),
  navbarBackgroundColor: text("navbar_background_color").notNull().default("#FFFFFF"),
  navbarTextColor: text("navbar_text_color").notNull().default("#111111"),
  footerBackgroundColor: text("footer_background_color").notNull().default("#111111"),
  footerTextColor: text("footer_text_color").notNull().default("#FFFFFF"),

  themePreset: text("theme_preset").notNull().default("custom"),
  brandingMode: text("branding_mode").notNull().default("logo_and_text"),
  logoSizeDesktop: integer("logo_size_desktop").notNull().default(32),
  logoSizeMobile: integer("logo_size_mobile").notNull().default(28),
  brandTextScale: numeric("brand_text_scale", { precision: 4, scale: 2 })
    .notNull()
    .default("1.00"),
  navbarBrandPosition: text("navbar_brand_position").notNull().default("left"),
  navbarMenuPosition: text("navbar_menu_position").notNull().default("center"),

  fontHeading: text("font_heading").notNull().default("Space Grotesk"),
  fontBody: text("font_body").notNull().default("Inter"),
  themeManualOverride: boolean("theme_manual_override").notNull().default(false),

  primaryColor: text("primary_color").notNull().default("#6D28D9"),
  accentColor: text("accent_color").notNull().default("#F472B6"),
  backgroundColor: text("background_color").notNull().default("#FAFAFA"),
  surfaceColor: text("surface_color").notNull().default("#FFFFFF"),
  textColor: text("text_color").notNull().default("#111111"),
  textMutedColor: text("text_muted_color").notNull().default("#6B7280"),
  borderColor: text("border_color").notNull().default("#E5E7EB"),

  supportWhatsapp: text("support_whatsapp"),
  contactEmail: text("contact_email"),
  supportInstagram: text("support_instagram"),
  supportTiktok: text("support_tiktok"),

  enableWhatsappCheckout: boolean("enable_whatsapp_checkout").notNull().default(false),
  enableWhatsappFab: boolean("enable_whatsapp_fab").notNull().default(true),

  heroBannerDesktopUrl: text("hero_banner_desktop_url"),
  heroBannerMobileUrl: text("hero_banner_mobile_url"),
  heroOverlayMode: text("hero_overlay_mode").default("gradient"),
  heroOverlayOpacity: integer("hero_overlay_opacity").default(60),

  orderNumberOffset: integer("order_number_offset").default(1007398),

  shippingCostClp: integer("shipping_cost_clp").notNull().default(3990),
  shippingFreeThresholdClp: integer("shipping_free_threshold_clp").notNull().default(30000),

  metaPixelId: text("meta_pixel_id"),
  metaCapiAccessToken: text("meta_capi_access_token"),
  metaPixelEnabled: boolean("meta_pixel_enabled").notNull().default(false),
  metaTestEventCode: text("meta_test_event_code"),

  clarityProjectId: text("clarity_project_id"),
  clarityEnabled: boolean("clarity_enabled").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
