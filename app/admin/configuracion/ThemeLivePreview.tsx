"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoreSettingsView } from "@/lib/store-settings/getStoreSettings";
import { resolveFontCssVar } from "@/lib/fonts/registry";

type ThemeLivePreviewProps = {
  formId: string;
  initial: StoreSettingsView;
};

type Palette = {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  border: string;
  navbarBackground: string;
  navbarText: string;
  footerBackground: string;
  footerText: string;
};

/**
 * Espejo de `getPresetThemePalette` en
 * `lib/store-settings/buildThemeCssProperties.ts` — mismos presets, mismos
 * valores. Se mantiene sincronizado a mano (mismo patrón ya usado antes de
 * este cambio); si un preset se agrega o cambia en un lado, debe replicarse
 * acá para que el preview no diverja de lo que realmente se guarda.
 */
export function getThemeFromPreset(preset: string): Palette {
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
      };
    case "natural_wellness":
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
      };
    case "tech_night":
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
      };
    case "warm_home":
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
      };
    case "editorial_minimal":
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
      };
    case "dynamic_offer":
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
      };
  }
}

export const THEME_PRESET_DESCRIPTIONS: Record<string, string> = {
  minimal_black: "Blanco y negro sobrio, de propósito general.",
  deep_violet: "Violeta profundo — identidad neutra por defecto.",
  premium_dark: "Oscuro premium con acento lavanda.",
  natural_green: "Verde y blanco, tono natural genérico.",
  pastel: "Tonos pastel suaves, delicado.",
  natural_wellness: "Verde profundo y crema cálido — ideal para suplementos, autocuidado y salud.",
  tech_night: "Grafito/negro con azul eléctrico o cian — ideal para gadgets, accesorios y electrónica.",
  warm_home: "Marfil, terracota suave y café — ideal para cocina, decoración y hogar.",
  editorial_minimal: "Blanco, negro y gris cálido con un acento sobrio — ideal para catálogos generales o premium.",
  dynamic_offer: "Alto contraste y CTA energético — ideal para testeo de productos y venta directa.",
  custom: "Colores 100% definidos a mano, sin preset.",
};

function safeNumber(value: string, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function slotClass(slot: "left" | "center" | "right") {
  if (slot === "left") return "justify-self-start";
  if (slot === "center") return "justify-self-center";
  return "justify-self-end";
}

export function ThemeLivePreview({ formId, initial }: ThemeLivePreviewProps) {
  const [current, setCurrent] = useState<StoreSettingsView>(initial);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    const updateFromForm = () => {
      const fd = new FormData(form);
      const read = (name: keyof StoreSettingsView, fallback: string) =>
        String(fd.get(name) ?? fallback).trim();
      const readPos = (name: keyof StoreSettingsView, fallback: "left" | "center" | "right") => {
        const val = read(name, fallback);
        return val === "left" || val === "center" || val === "right" ? val : fallback;
      };
      const readMode = (fallback: "logo" | "text" | "logo_and_text") => {
        const val = read("branding_mode", fallback);
        return val === "logo" || val === "text" || val === "logo_and_text" ? val : fallback;
      };

      setCurrent((prev) => ({
        ...prev,
        store_name: read("store_name", prev.store_name),
        logo_url: read("logo_url", prev.logo_url),
        logo_square_url: read("logo_square_url", prev.logo_square_url),
        theme_preset: read("theme_preset", prev.theme_preset),
        theme_manual_override: fd.get("theme_manual_override") === "true",
        branding_mode: readMode(prev.branding_mode),
        logo_size_desktop: safeNumber(
          read("logo_size_desktop", String(prev.logo_size_desktop)),
          prev.logo_size_desktop
        ),
        logo_size_mobile: safeNumber(
          read("logo_size_mobile", String(prev.logo_size_mobile)),
          prev.logo_size_mobile
        ),
        brand_text_scale: safeNumber(
          read("brand_text_scale", String(prev.brand_text_scale)),
          prev.brand_text_scale
        ),
        navbar_brand_position: readPos("navbar_brand_position", prev.navbar_brand_position),
        navbar_menu_position: readPos("navbar_menu_position", prev.navbar_menu_position),
        font_heading: read("font_heading", prev.font_heading),
        font_body: read("font_body", prev.font_body),
        primary_color: read("primary_color", prev.primary_color),
        accent_color: read("accent_color", prev.accent_color),
        background_color: read("background_color", prev.background_color),
        surface_color: read("surface_color", prev.surface_color),
        text_color: read("text_color", prev.text_color),
        border_color: read("border_color", prev.border_color),
        brand_text_color: read("brand_text_color", prev.brand_text_color),
        navbar_background_color: read("navbar_background_color", prev.navbar_background_color),
        navbar_text_color: read("navbar_text_color", prev.navbar_text_color),
      }));
    };

    updateFromForm();
    form.addEventListener("input", updateFromForm);
    form.addEventListener("change", updateFromForm);
    return () => {
      form.removeEventListener("input", updateFromForm);
      form.removeEventListener("change", updateFromForm);
    };
  }, [formId]);

  const palette = useMemo(() => {
    const preset = getThemeFromPreset(current.theme_preset);
    const useManual = current.theme_manual_override || current.theme_preset === "custom";
    return {
      primary: useManual ? current.primary_color : preset.primary,
      accent: useManual ? current.accent_color : preset.accent,
      background: useManual ? current.background_color : preset.background,
      surface: useManual ? current.surface_color : preset.surface,
      text: useManual ? current.text_color : preset.text,
      border: useManual ? current.border_color : preset.border,
      navbarBackground: useManual ? current.navbar_background_color : preset.navbarBackground,
      navbarText: useManual ? current.navbar_text_color : preset.navbarText,
      footerBackground: preset.footerBackground,
      footerText: preset.footerText,
    };
  }, [current]);

  const presetDescription =
    THEME_PRESET_DESCRIPTIONS[current.theme_preset] ?? "Preset personalizado.";

  const headingFontVar = resolveFontCssVar(current.font_heading, "var(--font-display)");
  const bodyFontVar = resolveFontCssVar(current.font_body, "var(--font-sans)");

  const brandColor = current.brand_text_color || palette.primary;
  const navBg = palette.navbarBackground || palette.surface;
  const navText = palette.navbarText || palette.text;
  const logoSrc = current.logo_url || current.logo_square_url;
  const showLogo = current.branding_mode === "logo" || current.branding_mode === "logo_and_text";
  const showText =
    current.branding_mode === "text" || current.branding_mode === "logo_and_text" || !logoSrc;

  return (
    <div className="mb-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <h2 className="text-sm font-semibold text-zinc-800">Preview en vivo</h2>
      <p className="mt-1 text-xs text-zinc-500">Se actualiza mientras editas, sin guardar.</p>
      <p className="mt-2 rounded-md bg-white px-3 py-2 text-xs text-zinc-600 ring-1 ring-inset ring-zinc-200">
        {presetDescription}
      </p>

      <div
        className="mt-3 overflow-hidden rounded-lg border"
        style={{ borderColor: palette.border, backgroundColor: palette.background, color: palette.text }}
      >
        <div
          className="grid h-14 grid-cols-3 items-center px-3"
          style={{ backgroundColor: navBg, borderBottom: `1px solid ${palette.border}` }}
        >
          <div className={slotClass(current.navbar_brand_position)}>
            <div className="flex min-w-0 items-center gap-2">
              {showLogo && logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoSrc}
                  alt={current.store_name}
                  className="w-auto rounded-md object-contain"
                  style={{ height: current.logo_size_mobile }}
                />
              ) : null}
              {showText ? (
                <span
                  className="truncate"
                  style={{
                    color: brandColor,
                    fontFamily: headingFontVar,
                    fontWeight: 800,
                    letterSpacing: "-0.04em",
                    fontSize: `calc(1.1rem * ${current.brand_text_scale})`,
                  }}
                >
                  {current.store_name}
                </span>
              ) : null}
            </div>
          </div>
          <div className={slotClass(current.navbar_menu_position)}>
            <div className="hidden items-center gap-4 text-xs md:flex" style={{ color: navText }}>
              <span>Productos</span>
              <span>Nosotros</span>
            </div>
          </div>
          <div className="justify-self-end text-sm" style={{ color: navText }}>
            🛍️
          </div>
        </div>

        <div className="space-y-3 p-4" style={{ fontFamily: bodyFontVar }}>
          <button
            type="button"
            className="rounded-md px-4 py-2 text-sm font-semibold text-white"
            style={{
              backgroundImage: `linear-gradient(135deg, ${palette.primary} 0%, ${palette.accent} 100%)`,
            }}
          >
            Botón principal
          </button>
          <div
            className="rounded-lg border p-3"
            style={{ backgroundColor: palette.surface, borderColor: palette.border }}
          >
            <p className="text-xs opacity-70">Producto ejemplo</p>
            <p
              className="mt-1 text-sm font-semibold"
              style={{ fontFamily: headingFontVar }}
            >
              Producto destacado de ejemplo
            </p>
            <p className="mt-1 text-sm" style={{ color: palette.primary }}>
              $19.990
            </p>
          </div>
        </div>

        <div
          className="flex items-center justify-between px-4 py-2.5 text-[11px]"
          style={{ backgroundColor: palette.footerBackground, color: palette.footerText }}
        >
          <span>Footer</span>
          <span className="opacity-70">© {current.store_name}</span>
        </div>
      </div>
    </div>
  );
}
