import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_STORE_SETTINGS,
  getStoreSettings,
  type StoreSettingsView,
} from "@/lib/store-settings/getStoreSettings";
import { FontSelectField } from "./FontSelectField";
import { ThemeLivePreview } from "./ThemeLivePreview";
import { HeroBannerSection } from "./HeroBannerSection";
import { FaviconUploadSection } from "./FaviconUploadSection";
import { LogoUploadField } from "./LogoUploadField";
import { ConfigTabs } from "./ConfigTabs";
import { SaveSettingsForm } from "./SaveSettingsForm";
import { fontNamesForRole } from "@/lib/fonts/registry";

export const metadata: Metadata = { title: "Configuración" };

// Derivadas del registry: si una fuente no está self-hosteada ahí, el admin no la puede ofrecer.
const HEADING_FONTS = fontNamesForRole("heading");
const BODY_FONTS = fontNamesForRole("body");

async function saveSettingsAction(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  "use server";

  function read(field: keyof StoreSettingsView) {
    return String(formData.get(field) ?? "").trim();
  }
  function readNumber(field: keyof StoreSettingsView, fallback: number) {
    const raw = Number(formData.get(field));
    return Number.isFinite(raw) && raw > 0 ? raw : fallback;
  }
  function readBoolean(field: keyof StoreSettingsView) {
    return formData.get(field) === "true";
  }
  function readBrandScale(field: keyof StoreSettingsView, fallback: number) {
    const raw = Number(formData.get(field));
    if (!Number.isFinite(raw)) return fallback;
    // DB constraint en store_settings_brand_text_scale_check: 0.50..3.00
    return Math.min(3, Math.max(0.5, raw));
  }
  function readHeroOverlayOpacity(field: keyof StoreSettingsView, fallback: number) {
    const raw = Number(formData.get(field));
    if (!Number.isFinite(raw)) return fallback;
    if (raw < 0 || raw > 90) return fallback;
    return Math.round(raw / 5) * 5;
  }
  function readNonNegativeInt(field: keyof StoreSettingsView, fallback: number) {
    const raw = Math.floor(Number(formData.get(field)));
    return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
  }
  function normalizeTikTok(value: string) {
    const raw = value.trim();
    if (!raw) return "";
    if (raw.startsWith("@")) return `https://tiktok.com/${raw}`;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^tiktok\.com\//i.test(raw) || /^www\.tiktok\.com\//i.test(raw)) {
      return `https://${raw.replace(/^https?:\/\//i, "")}`;
    }
    return raw;
  }

  const themePreset = read("theme_preset");
  const brandingMode = read("branding_mode");
  const brandPos = read("navbar_brand_position");
  const menuPos = read("navbar_menu_position");
  const fontHeading = read("font_heading");
  const fontBody = read("font_body");

  const validThemePreset = [
    "minimal_black",
    "pets_purple_pink",
    "premium_dark",
    "natural_green",
    "pastel",
    "custom",
  ].includes(themePreset)
    ? themePreset
    : DEFAULT_STORE_SETTINGS.theme_preset;
  const validBrandingMode = ["logo", "text", "logo_and_text"].includes(brandingMode)
    ? brandingMode
    : DEFAULT_STORE_SETTINGS.branding_mode;
  const validBrandPos = ["left", "center", "right"].includes(brandPos)
    ? brandPos
    : DEFAULT_STORE_SETTINGS.navbar_brand_position;
  const validMenuPos = ["left", "center", "right"].includes(menuPos)
    ? menuPos
    : DEFAULT_STORE_SETTINGS.navbar_menu_position;
  const validHeroOverlayMode = read("hero_overlay_mode") === "auto" ? "auto" : "manual";
  // Whitelist derivada del registry: defensa en profundidad si alguien postea
  // directo al server action saltándose el <select>; el fallback en
  // buildThemeCssProperties ya cubre esto, pero no queremos persistir basura.
  const validFontHeading = HEADING_FONTS.includes(fontHeading)
    ? fontHeading
    : DEFAULT_STORE_SETTINGS.font_heading;
  const validFontBody = BODY_FONTS.includes(fontBody)
    ? fontBody
    : DEFAULT_STORE_SETTINGS.font_body;

  // Leemos primero valores submitteados para evitar sobrescribir URLs de assets con string vacío
  // (los hidden inputs de HeroBannerSection/FaviconUploadSection/LogoUploadField solo cambian
  // cuando el admin sube un archivo nuevo; si no subió nada, el valor guardado debe persistir).
  const submittedDesktopUrl = read("hero_banner_desktop_url");
  const submittedMobileUrl = read("hero_banner_mobile_url");
  const submittedLogoUrl = read("logo_url");
  const submittedLogoSquareUrl = read("logo_square_url");
  const submittedFaviconUrl = read("favicon_url");
  const submittedAppleIconUrl = read("apple_icon_url");
  const submittedPwaIconUrl = read("pwa_icon_512_url");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const { data: existingRows } = await supabase
    .from("store_settings")
    .select(
      "id,hero_banner_desktop_url,hero_banner_mobile_url,logo_url,logo_square_url,favicon_url,apple_icon_url,pwa_icon_512_url"
    )
    .order("updated_at", { ascending: false })
    .limit(50);

  const existing = Array.isArray(existingRows) ? existingRows[0] : null;
  const duplicateIds =
    Array.isArray(existingRows) && existingRows.length > 1
      ? existingRows.slice(1).map((r: { id: string }) => r.id).filter(Boolean)
      : [];

  if (duplicateIds.length > 0) {
    await supabase.from("store_settings").delete().in("id", duplicateIds);
  }

  type PersistedAssetRow = {
    hero_banner_desktop_url?: string | null;
    hero_banner_mobile_url?: string | null;
    logo_url?: string | null;
    logo_square_url?: string | null;
    favicon_url?: string | null;
    apple_icon_url?: string | null;
    pwa_icon_512_url?: string | null;
  };
  const existingAssets = existing as PersistedAssetRow | null;

  const persistedDesktopUrl = submittedDesktopUrl || existingAssets?.hero_banner_desktop_url || "";
  const persistedMobileUrl = submittedMobileUrl || existingAssets?.hero_banner_mobile_url || "";
  const persistedLogoUrl = submittedLogoUrl || existingAssets?.logo_url || "";
  const persistedLogoSquareUrl = submittedLogoSquareUrl || existingAssets?.logo_square_url || "";
  const persistedFaviconUrl = submittedFaviconUrl || existingAssets?.favicon_url || "";
  const persistedAppleIconUrl = submittedAppleIconUrl || existingAssets?.apple_icon_url || "";
  const persistedPwaIconUrl = submittedPwaIconUrl || existingAssets?.pwa_icon_512_url || "";

  const payload = {
    store_name: read("store_name") || DEFAULT_STORE_SETTINGS.store_name,
    store_tagline: read("store_tagline"),
    logo_url: persistedLogoUrl,
    logo_square_url: persistedLogoSquareUrl,
    favicon_url: persistedFaviconUrl,
    apple_icon_url: persistedAppleIconUrl,
    pwa_icon_512_url: persistedPwaIconUrl,
    brand_text_color: read("brand_text_color") || DEFAULT_STORE_SETTINGS.brand_text_color,
    navbar_background_color:
      read("navbar_background_color") || DEFAULT_STORE_SETTINGS.navbar_background_color,
    navbar_text_color: read("navbar_text_color") || DEFAULT_STORE_SETTINGS.navbar_text_color,
    footer_background_color:
      read("footer_background_color") || DEFAULT_STORE_SETTINGS.footer_background_color,
    footer_text_color: read("footer_text_color") || DEFAULT_STORE_SETTINGS.footer_text_color,
    theme_preset: validThemePreset,
    branding_mode: validBrandingMode,
    logo_size_desktop: readNumber("logo_size_desktop", DEFAULT_STORE_SETTINGS.logo_size_desktop),
    logo_size_mobile: readNumber("logo_size_mobile", DEFAULT_STORE_SETTINGS.logo_size_mobile),
    brand_text_scale: readBrandScale("brand_text_scale", DEFAULT_STORE_SETTINGS.brand_text_scale),
    navbar_brand_position: validBrandPos,
    navbar_menu_position: validMenuPos,
    font_heading: validFontHeading,
    font_body: validFontBody,
    theme_manual_override: readBoolean("theme_manual_override"),
    primary_color: read("primary_color") || DEFAULT_STORE_SETTINGS.primary_color,
    accent_color: read("accent_color") || DEFAULT_STORE_SETTINGS.accent_color,
    background_color: read("background_color") || DEFAULT_STORE_SETTINGS.background_color,
    surface_color: read("surface_color") || DEFAULT_STORE_SETTINGS.surface_color,
    text_color: read("text_color") || DEFAULT_STORE_SETTINGS.text_color,
    text_muted_color: read("text_muted_color") || DEFAULT_STORE_SETTINGS.text_muted_color,
    border_color: read("border_color") || DEFAULT_STORE_SETTINGS.border_color,
    support_whatsapp: read("support_whatsapp"),
    contact_email: read("contact_email"),
    support_instagram: read("support_instagram"),
    support_tiktok: normalizeTikTok(read("support_tiktok")),
    hero_banner_desktop_url: persistedDesktopUrl,
    hero_banner_mobile_url: persistedMobileUrl,
    hero_overlay_mode: validHeroOverlayMode,
    hero_overlay_opacity: readHeroOverlayOpacity(
      "hero_overlay_opacity",
      DEFAULT_STORE_SETTINGS.hero_overlay_opacity
    ),
    enable_whatsapp_checkout: readBoolean("enable_whatsapp_checkout"),
    order_number_offset: readNonNegativeInt("order_number_offset", DEFAULT_STORE_SETTINGS.order_number_offset),
    shipping_cost_clp: readNonNegativeInt("shipping_cost_clp", DEFAULT_STORE_SETTINGS.shipping_cost_clp),
    shipping_free_threshold_clp: readNonNegativeInt(
      "shipping_free_threshold_clp",
      DEFAULT_STORE_SETTINGS.shipping_free_threshold_clp
    ),
    enable_whatsapp_fab: readBoolean("enable_whatsapp_fab"),
  };
  console.log("[hero-config-save] desktop url payload:", payload.hero_banner_desktop_url || "(empty)");
  console.log("[hero-config-save] mobile url payload:", payload.hero_banner_mobile_url || "(empty)");

  const operation = existing?.id
    ? supabase.from("store_settings").update(payload).eq("id", existing.id)
    : supabase.from("store_settings").insert(payload);

  const { error } = await operation;
  if (error) {
    console.error("[admin/configuracion] Error guardando store_settings:", error.message);
    return { error: `No se pudo guardar: ${error.message}` };
  }

  const { data: savedRow, error: savedError } = await supabase
    .from("store_settings")
    .select("id,hero_banner_desktop_url,hero_banner_mobile_url")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (savedError) {
    console.error("[hero-config-save] readback error", savedError.message);
  } else {
    console.log("[hero-config-save] saved settings", savedRow);
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/configuracion");
  revalidatePath("/checkout");
  return { success: true };
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
  autoComplete = "off",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: "text" | "url" | "color";
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      />
    </label>
  );
}

export default async function ConfiguracionPage() {
  const settings = await getStoreSettings();
  console.log("[hero-config-load] mobile url from store_settings:", settings.hero_banner_mobile_url || "(empty)");

  const identidadTab = (
    <>
      <div className="mb-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <h2 className="text-sm font-semibold text-zinc-800">Preset visual</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Selecciona una base de estilo o usa custom para controlar colores manuales.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700">Tema</span>
            <select
              name="theme_preset"
              defaultValue={settings.theme_preset}
              className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <option value="minimal_black">Minimal negro</option>
              <option value="pets_purple_pink">Mascotas morado/rosado</option>
              <option value="premium_dark">Premium oscuro</option>
              <option value="natural_green">Natural/verde</option>
              <option value="pastel">Pastel</option>
              <option value="custom">Custom (manual)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pt-7 text-sm text-zinc-700">
            <input
              type="checkbox"
              name="theme_manual_override"
              value="true"
              defaultChecked={settings.theme_manual_override}
              className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
            />
            Forzar colores manuales sobre preset
          </label>
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <h2 className="text-sm font-semibold text-zinc-800">Branding</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700">Modo de branding</span>
            <select
              name="branding_mode"
              defaultValue={settings.branding_mode}
              className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <option value="logo">Solo logo</option>
              <option value="text">Solo texto</option>
              <option value="logo_and_text">Logo + texto</option>
            </select>
          </label>
          <FaviconUploadSection
            formId="store-settings-form"
            initialFaviconUrl={settings.favicon_url}
            initialAppleIconUrl={settings.apple_icon_url}
            initialPwaIconUrl={settings.pwa_icon_512_url}
          />
          <Field
            label="Tamaño logo desktop (px)"
            name="logo_size_desktop"
            type="text"
            defaultValue={String(settings.logo_size_desktop)}
            placeholder="32"
          />
          <Field
            label="Tamaño logo mobile (px)"
            name="logo_size_mobile"
            type="text"
            defaultValue={String(settings.logo_size_mobile)}
            placeholder="28"
          />
          <Field
            label="Escala texto marca"
            name="brand_text_scale"
            type="text"
            defaultValue={String(settings.brand_text_scale)}
            placeholder="1"
          />
          <Field
            label="Color texto marca"
            name="brand_text_color"
            type="color"
            defaultValue={settings.brand_text_color}
          />
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <h2 className="text-sm font-semibold text-zinc-800">Navbar</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700">Posición branding</span>
            <select
              name="navbar_brand_position"
              defaultValue={settings.navbar_brand_position}
              className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <option value="left">Izquierda</option>
              <option value="center">Centro</option>
              <option value="right">Derecha</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700">Posición menú</span>
            <select
              name="navbar_menu_position"
              defaultValue={settings.navbar_menu_position}
              className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <option value="left">Izquierda</option>
              <option value="center">Centro</option>
              <option value="right">Derecha</option>
            </select>
          </label>
          <Field
            label="Fondo navbar"
            name="navbar_background_color"
            type="color"
            defaultValue={settings.navbar_background_color}
          />
          <Field
            label="Texto navbar"
            name="navbar_text_color"
            type="color"
            defaultValue={settings.navbar_text_color}
          />
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <h2 className="text-sm font-semibold text-zinc-800">Footer</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Fondo footer"
            name="footer_background_color"
            type="color"
            defaultValue={settings.footer_background_color}
          />
          <Field
            label="Texto footer"
            name="footer_text_color"
            type="color"
            defaultValue={settings.footer_text_color}
          />
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <h2 className="text-sm font-semibold text-zinc-800">Tipografía</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FontSelectField
            label="Fuente headings"
            name="font_heading"
            defaultValue={settings.font_heading}
            options={HEADING_FONTS}
            helperText="Puedes usar fuentes display como Playfair Display para titulares."
            previewText="Vista heading: Título de ejemplo para tu marca"
          />
          <FontSelectField
            label="Fuente cuerpo"
            name="font_body"
            defaultValue={settings.font_body}
            options={BODY_FONTS}
            helperText="Solo fuentes legibles para textos largos."
            previewText="Vista cuerpo: Este texto simula párrafos y descripciones de productos."
          />
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <h2 className="text-sm font-semibold text-zinc-800">Colores manuales</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Se mantienen como override cuando el preset es custom o si activas &quot;Forzar colores manuales&quot;.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Color primario"
            name="primary_color"
            type="color"
            defaultValue={settings.primary_color}
          />
          <Field
            label="Color acento"
            name="accent_color"
            type="color"
            defaultValue={settings.accent_color}
          />
          <Field
            label="Color fondo"
            name="background_color"
            type="color"
            defaultValue={settings.background_color}
          />
          <Field
            label="Color superficie"
            name="surface_color"
            type="color"
            defaultValue={settings.surface_color}
          />
          <Field
            label="Color texto"
            name="text_color"
            type="color"
            defaultValue={settings.text_color}
          />
          <Field
            label="Color texto secundario"
            name="text_muted_color"
            type="color"
            defaultValue={settings.text_muted_color}
          />
          <Field
            label="Color borde"
            name="border_color"
            type="color"
            defaultValue={settings.border_color}
          />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 md:grid-cols-2">
        <h2 className="text-sm font-semibold text-zinc-800 md:col-span-2">Datos de la tienda</h2>
        <Field
          label="Nombre de la tienda"
          name="store_name"
          defaultValue={settings.store_name}
          placeholder="PonkyBonk"
        />
        <Field
          label="Tagline"
          name="store_tagline"
          defaultValue={settings.store_tagline}
          placeholder="Todo para gatos felices"
        />
        <LogoUploadField
          formId="store-settings-form"
          fieldName="logo_url"
          label="Logo horizontal"
          kind="horizontal"
          initialUrl={settings.logo_url}
          helperText="Wordmark/logo ancho, para navbar y footer."
        />
        <LogoUploadField
          formId="store-settings-form"
          fieldName="logo_square_url"
          label="Logo cuadrado"
          kind="square"
          initialUrl={settings.logo_square_url}
          helperText="Isotipo cuadrado, para el sidebar del admin y compartir en redes."
        />
      </div>

      <HeroBannerSection
        formId="store-settings-form"
        initialDesktopUrl={settings.hero_banner_desktop_url}
        initialMobileUrl={settings.hero_banner_mobile_url}
        initialOverlayMode={settings.hero_overlay_mode}
        initialOverlayOpacity={settings.hero_overlay_opacity}
      />
    </>
  );

  const contactoTab = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field
        label="WhatsApp"
        name="support_whatsapp"
        defaultValue={settings.support_whatsapp}
        placeholder="56912345678"
      />
      <Field
        label="Email de contacto"
        name="contact_email"
        type="text"
        defaultValue={settings.contact_email}
        placeholder="contacto@mitienda.cl"
      />
      <Field
        label="Instagram URL"
        name="support_instagram"
        type="url"
        defaultValue={settings.support_instagram}
        placeholder="https://instagram.com/..."
      />
      <Field
        label="TikTok URL"
        name="support_tiktok"
        type="text"
        defaultValue={settings.support_tiktok}
        placeholder="@usuario o https://tiktok.com/@usuario"
      />
      <label className="flex items-center gap-2 text-sm text-zinc-700 md:col-span-2">
        <input
          type="checkbox"
          name="enable_whatsapp_fab"
          value="true"
          defaultChecked={settings.enable_whatsapp_fab}
          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
        />
        Mostrar botón flotante de WhatsApp en toda la tienda (contacto general, no requiere carrito)
      </label>
    </div>
  );

  const ventasTab = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <label className="flex items-center gap-2 text-sm text-zinc-700 md:col-span-2">
        <input
          type="checkbox"
          name="enable_whatsapp_checkout"
          value="true"
          defaultChecked={settings.enable_whatsapp_checkout}
          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
        />
        Mostrar &quot;Pedir por WhatsApp&quot; en el carrito (cierra el pedido por chat)
      </label>

      <label className="flex flex-col gap-1.5 md:col-span-2">
        <span className="text-sm font-medium text-zinc-700">Offset de número de pedido</span>
        <input
          type="number"
          name="order_number_offset"
          min="0"
          step="1"
          defaultValue={settings.order_number_offset}
          autoComplete="off"
          className="h-10 w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
        <span className="text-xs text-zinc-500">
          Se suma al número interno para generar el código de pedido visible al cliente (SO + 8 dígitos).
          Con offset 0, el pedido #1 → <code>SO00000001</code>. Con offset 1000000 → <code>SO01000001</code>.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-700">Costo de envío (CLP)</span>
        <input
          type="number"
          name="shipping_cost_clp"
          min="0"
          step="1"
          defaultValue={settings.shipping_cost_clp}
          autoComplete="off"
          className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
        <span className="text-xs text-zinc-500">
          Monto fijo que se cobra por despacho cuando el pedido no alcanza el envío gratis.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-700">Umbral envío gratis (CLP)</span>
        <input
          type="number"
          name="shipping_free_threshold_clp"
          min="0"
          step="1"
          defaultValue={settings.shipping_free_threshold_clp}
          autoComplete="off"
          className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
        <span className="text-xs text-zinc-500">
          Subtotal desde el cual el envío pasa a ser gratis. Se usa en checkout, Flow y la barra de progreso.
        </span>
      </label>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Configuración de la tienda</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Administra nombre, branding y canales de contacto de la tienda.
        </p>
      </div>

      <SaveSettingsForm action={saveSettingsAction}>
        <ThemeLivePreview formId="store-settings-form" initial={settings} />

        <ConfigTabs identidad={identidadTab} contacto={contactoTab} ventas={ventasTab} />
      </SaveSettingsForm>
    </div>
  );
}
