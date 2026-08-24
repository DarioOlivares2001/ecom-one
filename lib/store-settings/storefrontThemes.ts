/**
 * Temas estructurales del storefront: definen layout, jerarquía y
 * estrategia de renderizado de la ficha de producto — nunca colores (eso es
 * el preset visual, independiente, ver `buildThemeCssProperties.ts`).
 *
 * Módulo puro (sin "server-only", sin DB): se usa tanto en servidor
 * (resolución del tema a renderizar) como en el admin (tarjetas de
 * selección) y en pruebas.
 */

export const STOREFRONT_THEME_IDS = ["conversion", "wellness", "technical", "offer"] as const;
export type StorefrontThemeId = (typeof STOREFRONT_THEME_IDS)[number];

export const DEFAULT_STOREFRONT_THEME: StorefrontThemeId = "conversion";

export interface StorefrontThemeDefinition {
  id: StorefrontThemeId;
  name: string;
  description: string;
  recommendedFor: string;
  /** Bloques macro en el orden en que este tema los presenta, solo para mostrar la diferencia estructural en el admin. */
  structure: string[];
}

export const STOREFRONT_THEMES: Record<StorefrontThemeId, StorefrontThemeDefinition> = {
  conversion: {
    id: "conversion",
    name: "Conversión directa",
    description:
      "El layout base actual: precio, oferta, CTA, beneficios y compra rápida por delante.",
    recommendedFor: "Tiendas generales y testeo de productos.",
    structure: ["Galería + compra", "Bloques del producto (orden del admin)", "Reseñas", "Relacionados"],
  },
  wellness: {
    id: "wellness",
    name: "Bienestar y suplementos",
    description:
      "Foco editorial y premium, con más aire entre secciones y lectura cómoda. Prioriza beneficios y uso diario.",
    recommendedFor: "Vitanara y productos de suplementos/bienestar.",
    structure: [
      "Galería",
      "Compra",
      "Beneficios",
      "Uso diario / presentación",
      "Resto de bloques del producto",
      "Reseñas",
      "Relacionados (solo si son realmente afines)",
    ],
  },
  technical: {
    id: "technical",
    name: "Tecnología y herramientas",
    description:
      "Presentación densa y técnica. Prioriza medidas, versatilidad y uso cuando existen en la ficha.",
    recommendedFor: "Herramientas, gadgets, electrodomésticos y accesorios.",
    structure: [
      "Galería + compra (densa)",
      "Medidas",
      "Versatilidad",
      "Uso",
      "Resto de bloques del producto",
      "Reseñas",
      "Relacionados",
    ],
  },
  offer: {
    id: "offer",
    name: "Oferta dinámica",
    description:
      "Foco en catálogo general y promociones reales: precio, ahorro y descuentos por cantidad visibles con moderación.",
    recommendedFor: "Catálogo general y venta con promociones activas.",
    structure: [
      "Galería + compra (con ahorro y descuento por cantidad)",
      "Bloques del producto (orden del admin)",
      "Reseñas",
      "Relacionados",
    ],
  },
};

export const STOREFRONT_THEME_LIST: StorefrontThemeDefinition[] = STOREFRONT_THEME_IDS.map(
  (id) => STOREFRONT_THEMES[id]
);

/**
 * Resuelve un valor crudo de `store_settings.storefront_theme` (puede venir
 * vacío, `null`, o con un valor legado/corrupto) a un id de tema válido.
 * Nunca lanza — siempre cae a `conversion`, el mismo default de la columna.
 */
export function resolveStorefrontTheme(raw: string | null | undefined): StorefrontThemeId {
  if (typeof raw === "string" && (STOREFRONT_THEME_IDS as readonly string[]).includes(raw)) {
    return raw as StorefrontThemeId;
  }
  return DEFAULT_STOREFRONT_THEME;
}
