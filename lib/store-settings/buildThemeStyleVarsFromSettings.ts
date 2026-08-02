import type { CSSProperties } from "react";
import type { StoreSettingsView } from "@/lib/store-settings/getStoreSettings";
import { buildThemeCssProperties } from "@/lib/store-settings/buildThemeCssProperties";

/** Alias: mismas variables que `app/layout.tsx` y el preview admin. */
export function buildThemeStyleVarsFromSettings(settings: StoreSettingsView): CSSProperties {
  return buildThemeCssProperties(settings);
}
