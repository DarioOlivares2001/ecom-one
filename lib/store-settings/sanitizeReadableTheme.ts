/**
 * Ajusta background / surface / text / muted / border cuando el contraste es ilegible
 * (p. ej. valores casi negros guardados en store_settings con texto oscuro).
 * No modifica primary/accent ni navbar/footer.
 */

export type CanvasThemeColors = {
  background_color: string;
  surface_color: string;
  text_color: string;
  text_muted_color: string;
  border_color: string;
};

const SAFE = {
  onDark: {
    text: "#F8FAFC",
    textMuted: "#CBD5E1",
    border: "#64748B",
  },
  onLight: {
    text: "#0F172A",
    textMuted: "#64748B",
    border: "#E2E8F0",
  },
  lightSurface: "#FFFFFF",
  lightBackground: "#F8FAFC",
} as const;

function parseHex(input: string): [number, number, number] | null {
  const s = input.trim();
  if (!s.startsWith("#")) return null;
  let h = s.slice(1);
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return [r, g, b];
}

function linearize(channel: number): number {
  const v = channel / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** Luminancia relativa WCAG 0..1 */
export function relativeLuminanceFromHex(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(linearize) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Ratio de contraste entre dos colores (>= 1). */
export function contrastRatio(hexA: string, hexB: string): number | null {
  const La = relativeLuminanceFromHex(hexA);
  const Lb = relativeLuminanceFromHex(hexB);
  if (La == null || Lb == null) return null;
  const lighter = Math.max(La, Lb);
  const darker = Math.min(La, Lb);
  return (lighter + 0.05) / (darker + 0.05);
}

function isDarkCanvas(L: number | null): boolean {
  if (L == null) return false;
  return L < 0.35;
}

/**
 * Devuelve copia con colores de canvas saneados si el contraste es malo.
 */
export function sanitizeReadableCanvasColors(input: CanvasThemeColors): CanvasThemeColors {
  const background = input.background_color.trim();
  let surface = input.surface_color.trim();
  let text = input.text_color.trim();
  let textMuted = input.text_muted_color.trim();
  let border = input.border_color.trim();

  const Lbg = relativeLuminanceFromHex(background);
  const Lsf = relativeLuminanceFromHex(surface);
  const Ltx = relativeLuminanceFromHex(text);

  // Caso típico: todo negro / casi negro con texto oscuro → canvas claro legible
  if (Lbg != null && Lsf != null && Ltx != null && Lbg < 0.12 && Lsf < 0.12 && Ltx < 0.45) {
    return {
      background_color: SAFE.lightBackground,
      surface_color: SAFE.lightSurface,
      text_color: SAFE.onLight.text,
      text_muted_color: SAFE.onLight.textMuted,
      border_color: SAFE.onLight.border,
    };
  }

  const cTextBg = contrastRatio(text, background);
  if (cTextBg != null && cTextBg < 4.5) {
    if (isDarkCanvas(Lbg)) {
      text = SAFE.onDark.text;
      textMuted = SAFE.onDark.textMuted;
      border = SAFE.onDark.border;
    } else {
      text = SAFE.onLight.text;
      textMuted = SAFE.onLight.textMuted;
      border = SAFE.onLight.border;
    }
  }

  const cTextSf = contrastRatio(text, surface);
  if (cTextSf != null && cTextSf < 4.5) {
    const Ltx2 = relativeLuminanceFromHex(text);
    if ((Lsf ?? 1) < 0.32 && (Ltx2 ?? 0) < 0.45) {
      surface = SAFE.lightSurface;
      text = SAFE.onLight.text;
      textMuted = SAFE.onLight.textMuted;
      border = SAFE.onLight.border;
    } else if ((Lsf ?? 0) > 0.92 && (Ltx2 ?? 0) > 0.55) {
      text = SAFE.onLight.text;
      textMuted = SAFE.onLight.textMuted;
    }
  }

  const cMutedBg = contrastRatio(textMuted, background);
  if (cMutedBg != null && cMutedBg < 3) {
    textMuted = isDarkCanvas(Lbg) ? SAFE.onDark.textMuted : SAFE.onLight.textMuted;
  }

  return {
    background_color: background,
    surface_color: surface,
    text_color: text,
    text_muted_color: textMuted,
    border_color: border,
  };
}

export function canvasColorsChanged(before: CanvasThemeColors, after: CanvasThemeColors): boolean {
  return (
    before.background_color !== after.background_color ||
    before.surface_color !== after.surface_color ||
    before.text_color !== after.text_color ||
    before.text_muted_color !== after.text_muted_color ||
    before.border_color !== after.border_color
  );
}
