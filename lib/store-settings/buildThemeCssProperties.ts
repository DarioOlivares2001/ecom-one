import type { CSSProperties } from "react";
import type { StoreSettingsView } from "@/lib/store-settings/getStoreSettings";
import { canvasColorsChanged, sanitizeReadableCanvasColors } from "@/lib/store-settings/sanitizeReadableTheme";
import { resolveFontCssVar } from "@/lib/fonts/registry";

type ThemePalette = {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  border: string;
  /** Fondo/texto del navbar propios del preset (independientes de `primary`/`surface`). */
  navbarBackground: string;
  navbarText: string;
  footerBackground: string;
  footerText: string;
  /** Color del badge de oferta ("-X%"). */
  badge: string;
  /** Hover del CTA primario. Si se omite, se calcula oscureciendo `primary`. */
  primaryHover?: string;
};

/**
 * Preset "deep_violet" es también el fallback para `preset` vacío, `"custom"`
 * (cuando no aplica override manual) o cualquier valor legado desconocido —
 * queda como la identidad neutra por defecto de una instalación nueva.
 *
 * Los 5 presets con nombre de nicho (`natural_wellness`, `tech_night`,
 * `warm_home`, `editorial_minimal`, `dynamic_offer`) se AGREGAN a los 6
 * genéricos ya existentes — ninguno de los 6 originales cambia de valor, así
 * que una tienda que ya use uno de ellos (incluida la fila actual de
 * store_settings) se sigue viendo exactamente igual.
 */
export function getPresetThemePalette(preset: string): ThemePalette {
  switch (preset) {
    case "minimal_black":
      return {
        primary: "#111111",
        accent: "#2A2A2A",
        background: "#FAFAFA",
        surface: "#FFFFFF",
        text: "#111111",
        border: "#E5E7EB",
        navbarBackground: "#FFFFFF",
        navbarText: "#111111",
        footerBackground: "#111111",
        footerText: "#FFFFFF",
        badge: "#111111",
      };
    case "premium_dark":
      return {
        primary: "#0F172A",
        accent: "#A78BFA",
        background: "#090B12",
        surface: "#121726",
        text: "#E5E7EB",
        border: "#283042",
        navbarBackground: "#090B12",
        navbarText: "#E5E7EB",
        footerBackground: "#05070C",
        footerText: "#E5E7EB",
        badge: "#A78BFA",
      };
    case "natural_green":
      return {
        primary: "#166534",
        accent: "#84CC16",
        background: "#F6F9F3",
        surface: "#FFFFFF",
        text: "#1F2937",
        border: "#D9E6D2",
        navbarBackground: "#FFFFFF",
        navbarText: "#1F2937",
        footerBackground: "#14532D",
        footerText: "#F0FDF4",
        badge: "#84CC16",
      };
    case "pastel":
      return {
        primary: "#A78BFA",
        accent: "#F9A8D4",
        background: "#FFF9FC",
        surface: "#FFFFFF",
        text: "#334155",
        border: "#F1DDF0",
        navbarBackground: "#FFFFFF",
        navbarText: "#334155",
        footerBackground: "#F1DDF0",
        footerText: "#334155",
        badge: "#F9A8D4",
      };
    // ── Presets de nicho (nuevos) ──────────────────────────────────────
    case "natural_wellness":
      // Bienestar natural: verde profundo + crema cálido. Suplementos,
      // autocuidado y salud.
      return {
        primary: "#2F5233",
        accent: "#8A9B68",
        background: "#FBF6EC",
        surface: "#FFFFFF",
        text: "#2B2B22",
        border: "#E4DCC8",
        navbarBackground: "#FBF6EC",
        navbarText: "#2B2B22",
        footerBackground: "#223526",
        footerText: "#F3EFE1",
        badge: "#B45309",
        primaryHover: "#233F27",
      };
    case "tech_night":
      // Tecnología nocturna: grafito/negro + azul eléctrico/cian. Gadgets,
      // accesorios y electrónica.
      return {
        primary: "#111827",
        accent: "#22D3EE",
        background: "#0B0F14",
        surface: "#151A21",
        text: "#E5E7EB",
        border: "#262D38",
        navbarBackground: "#0B0F14",
        navbarText: "#E5E7EB",
        footerBackground: "#05070A",
        footerText: "#93C5FD",
        badge: "#FB923C",
        primaryHover: "#1F2937",
      };
    case "warm_home":
      // Hogar cálido: marfil, terracota suave, café. Cocina, decoración y
      // hogar.
      return {
        primary: "#C97B4A",
        accent: "#8B5E3C",
        background: "#FBF3E7",
        surface: "#FFFFFF",
        text: "#4A3728",
        border: "#E8D9C5",
        navbarBackground: "#FBF3E7",
        navbarText: "#4A3728",
        footerBackground: "#4A3728",
        footerText: "#FBF3E7",
        badge: "#B5651D",
        primaryHover: "#A8623A",
      };
    case "editorial_minimal":
      // Editorial minimal: blanco, negro, gris cálido, acento sobrio.
      // Tiendas generales o catálogo premium.
      return {
        primary: "#18181B",
        accent: "#7C6A58",
        background: "#FFFFFF",
        surface: "#FAFAFA",
        text: "#18181B",
        border: "#E4E4E7",
        navbarBackground: "#FFFFFF",
        navbarText: "#18181B",
        footerBackground: "#18181B",
        footerText: "#FFFFFF",
        badge: "#7C6A58",
        primaryHover: "#000000",
      };
    case "dynamic_offer":
      // Oferta dinámica: alto contraste, CTA energético. Testeo de
      // productos y venta directa.
      return {
        primary: "#EF4444",
        accent: "#FACC15",
        background: "#FFFFFF",
        surface: "#FFFFFF",
        text: "#111111",
        border: "#111111",
        navbarBackground: "#111111",
        navbarText: "#FFFFFF",
        footerBackground: "#111111",
        footerText: "#FFFFFF",
        badge: "#FACC15",
        primaryHover: "#B91C1C",
      };
    case "deep_violet":
    default:
      return {
        primary: "#3B2E7E",
        accent: "#5B4A9C",
        background: "#FAF8F5",
        surface: "#FFFFFF",
        text: "#1F2933",
        border: "#E5E7EB",
        navbarBackground: "#FFFFFF",
        navbarText: "#1F2933",
        footerBackground: "#111111",
        footerText: "#FFFFFF",
        badge: "#FF385C",
      };
  }
}

/** Oscurece un color hex un `amount` (0-1) manteniendo el mismo matiz de base. */
function darkenHex(hex: string, amount: number): string {
  const value = hex.replace("#", "");
  if (value.length !== 6) return hex;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return hex;
  const factor = 1 - amount;
  const toHex = (v: number) => Math.round(Math.max(0, Math.min(255, v * factor)))
    .toString(16)
    .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function toRgbTriplet(hex: string, fallback: string) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return fallback;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return fallback;
  return `${r} ${g} ${b}`;
}

function isVeryLight(hex: string) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return false;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return false;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 220;
}

/** Colores de pintura (canvas + marca) según preset / override manual. */
export function computeThemePaint(settings: StoreSettingsView) {
  const presetTheme = getPresetThemePalette(settings.theme_preset);
  const useManualColors = settings.theme_manual_override || settings.theme_preset === "custom";
  const primary = useManualColors ? settings.primary_color : presetTheme.primary;
  const accent = useManualColors ? settings.accent_color : presetTheme.accent;
  const background = useManualColors ? settings.background_color : presetTheme.background;
  const surface = useManualColors ? settings.surface_color : presetTheme.surface;
  const text = useManualColors ? settings.text_color : presetTheme.text;
  const border = useManualColors ? settings.border_color : presetTheme.border;
  const textMuted = useManualColors
    ? settings.text_muted_color
    : settings.text_muted_color?.trim() || presetTheme.text;

  // Navbar/footer: en modo manual siguen viniendo de sus propias columnas
  // (ya existían para personalización directa); con preset activo, el
  // preset también los define — antes quedaban siempre en su color manual
  // sin importar el preset elegido.
  const navbarBackground = useManualColors
    ? settings.navbar_background_color
    : presetTheme.navbarBackground;
  const navbarText = useManualColors ? settings.navbar_text_color : presetTheme.navbarText;
  const footerBackground = useManualColors
    ? settings.footer_background_color
    : presetTheme.footerBackground;
  const footerText = useManualColors ? settings.footer_text_color : presetTheme.footerText;

  // No hay columna manual dedicada para el badge de oferta — en modo manual
  // se alinea con el acento elegido a mano.
  const badge = useManualColors ? accent : presetTheme.badge;

  const primaryHover = useManualColors
    ? darkenHex(primary, 0.14)
    : (presetTheme.primaryHover ?? darkenHex(presetTheme.primary, 0.14));

  return {
    primary,
    accent,
    background,
    surface,
    text,
    textMuted,
    border,
    navbarBackground,
    navbarText,
    footerBackground,
    footerText,
    badge,
    primaryHover,
  };
}

/**
 * Variables CSS de tema para `body` (tienda) o contenedor de preview admin.
 * Los colores de canvas ya deben venir saneados desde `getStoreSettings`.
 */
export function buildThemeCssProperties(settings: StoreSettingsView): CSSProperties {
  const paint = computeThemePaint(settings);
  const canvasBefore = {
    background_color: paint.background,
    surface_color: paint.surface,
    text_color: paint.text,
    text_muted_color: paint.textMuted,
    border_color: paint.border,
  };
  const safe = sanitizeReadableCanvasColors(canvasBefore);

  if (process.env.NODE_ENV === "development" && canvasColorsChanged(canvasBefore, safe)) {
    console.warn("[theme] Colores de canvas ajustados por contraste (tienda / preview):", {
      antes: canvasBefore,
      despues: safe,
    });
  }

  const { primary, accent, navbarBackground, navbarText, footerBackground, footerText, badge, primaryHover } = paint;
  const background = safe.background_color;
  const surface = safe.surface_color;
  const text = safe.text_color;
  const textMuted = safe.text_muted_color;
  const border = safe.border_color;

  const primaryRgb = toRgbTriplet(primary, "59 46 126");
  const accentRgb = toRgbTriplet(accent, "91 74 156");
  const headingFont = resolveFontCssVar(settings.font_heading, "var(--font-display)");
  const bodyFont = resolveFontCssVar(settings.font_body, "var(--font-sans)");
  const logoDesktop = Number(settings.logo_size_desktop) > 0 ? settings.logo_size_desktop : 32;
  const logoMobile = Number(settings.logo_size_mobile) > 0 ? settings.logo_size_mobile : 28;
  const brandScale = Number(settings.brand_text_scale) > 0 ? settings.brand_text_scale : 1;
  const brandTextColor = isVeryLight(primary) ? text : primary;

  return {
    "--brand-primary": primary,
    "--brand-accent": accent,
    "--brand-gradient": `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)`,
    "--brand-soft": `linear-gradient(135deg, rgb(${primaryRgb} / 0.14) 0%, rgb(${accentRgb} / 0.12) 100%)`,
    "--brand-ring": `rgb(${primaryRgb} / 0.42)`,
    "--color-primary": primary,
    "--color-primary-hover": primaryHover,
    "--color-accent": accent,
    "--color-background": background,
    "--color-surface": surface,
    "--color-text": text,
    "--color-text-muted": textMuted,
    "--color-border": border,
    "--color-badge": badge,
    "--navbar-background": navbarBackground,
    "--navbar-text": navbarText,
    "--footer-background": footerBackground,
    "--footer-text": footerText,
    "--font-heading": headingFont,
    "--font-body": bodyFont,
    "--logo-size-desktop": `${logoDesktop}px`,
    "--logo-size-mobile": `${logoMobile}px`,
    "--brand-scale": String(brandScale),
    "--brand-text-color": brandTextColor,
  } as CSSProperties;
}
