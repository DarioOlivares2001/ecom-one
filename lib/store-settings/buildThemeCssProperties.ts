import type { CSSProperties } from "react";
import type { StoreSettingsView } from "@/lib/store-settings/getStoreSettings";
import { canvasColorsChanged, sanitizeReadableCanvasColors } from "@/lib/store-settings/sanitizeReadableTheme";
import { resolveFontCssVar } from "@/lib/fonts/registry";

type ThemePreset =
  | "minimal_black"
  | "pets_purple_pink"
  | "premium_dark"
  | "natural_green"
  | "pastel";

type ThemePalette = {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  border: string;
};

export function getPresetThemePalette(preset: string): ThemePalette {
  const safePreset: ThemePreset =
    preset === "minimal_black" ||
    preset === "pets_purple_pink" ||
    preset === "premium_dark" ||
    preset === "natural_green" ||
    preset === "pastel"
      ? preset
      : "pets_purple_pink";

  switch (safePreset) {
    case "minimal_black":
      return {
        primary: "#111111",
        accent: "#2A2A2A",
        background: "#FAFAFA",
        surface: "#FFFFFF",
        text: "#111111",
        border: "#E5E7EB",
      };
    case "premium_dark":
      return {
        primary: "#0F172A",
        accent: "#A78BFA",
        background: "#090B12",
        surface: "#121726",
        text: "#E5E7EB",
        border: "#283042",
      };
    case "natural_green":
      return {
        primary: "#166534",
        accent: "#84CC16",
        background: "#F6F9F3",
        surface: "#FFFFFF",
        text: "#1F2937",
        border: "#D9E6D2",
      };
    case "pastel":
      return {
        primary: "#A78BFA",
        accent: "#F9A8D4",
        background: "#FFF9FC",
        surface: "#FFFFFF",
        text: "#334155",
        border: "#F1DDF0",
      };
    case "pets_purple_pink":
    default:
      return {
        primary: "#6D28D9",
        accent: "#F472B6",
        background: "#FAFAFA",
        surface: "#FFFFFF",
        text: "#111111",
        border: "#E5E7EB",
      };
  }
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

  return {
    primary,
    accent,
    background,
    surface,
    text,
    textMuted,
    border,
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

  const { primary, accent } = paint;
  const background = safe.background_color;
  const surface = safe.surface_color;
  const text = safe.text_color;
  const textMuted = safe.text_muted_color;
  const border = safe.border_color;

  const primaryRgb = toRgbTriplet(primary, "109 40 217");
  const accentRgb = toRgbTriplet(accent, "244 114 182");
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
    "--color-accent": accent,
    "--color-background": background,
    "--color-surface": surface,
    "--color-text": text,
    "--color-text-muted": textMuted,
    "--color-border": border,
    "--font-heading": headingFont,
    "--font-body": bodyFont,
    "--logo-size-desktop": `${logoDesktop}px`,
    "--logo-size-mobile": `${logoMobile}px`,
    "--brand-scale": String(brandScale),
    "--brand-text-color": brandTextColor,
  } as CSSProperties;
}
