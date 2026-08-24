/**
 * Temas estructurales del storefront: definen layout, jerarquía y
 * experiencia real por nicho — Home, catálogo y ficha de producto. Nunca
 * colores/tipografía/bordes/sombras/radios: eso es el PRESET VISUAL,
 * independiente y compatible con cualquier tema (ver
 * `buildThemeCssProperties.ts`). Un tema estructural decide QUÉ se muestra y
 * en qué orden; un preset visual decide de qué COLOR/con qué TOKENS se ve.
 *
 * Arquitectura extensible a propósito: agregar un tercer tema es agregar una
 * entrada acá + un layout nuevo por página (Home/Catálogo/Ficha) que
 * implemente el mismo contrato — nunca condicionales `if (theme === ...)`
 * desperdigados. Se entregan solo 2 temas bien terminados por ahora; no se
 * crean temas adicionales especulativos.
 *
 * Módulo puro (sin "server-only", sin DB): se usa tanto en servidor
 * (resolución del tema a renderizar) como en el admin (tarjetas de
 * selección) y en pruebas.
 */

export const STOREFRONT_THEME_IDS = ["conversion-general", "wellness-supplements"] as const;
export type StorefrontThemeId = (typeof STOREFRONT_THEME_IDS)[number];

export const DEFAULT_STOREFRONT_THEME: StorefrontThemeId = "conversion-general";

export interface StorefrontThemeDefinition {
  id: StorefrontThemeId;
  name: string;
  description: string;
  recommendedFor: string;
  /** Bloques macro en el orden en que este tema los presenta, solo para mostrar la diferencia estructural real en el admin (Home, Catálogo y Ficha). */
  structure: string[];
}

export const STOREFRONT_THEMES: Record<StorefrontThemeId, StorefrontThemeDefinition> = {
  "conversion-general": {
    id: "conversion-general",
    name: "Conversión general",
    description:
      "El diseño actual de la tienda, sin cambios: precio, oferta, CTA, beneficios y compra rápida por delante en Home, catálogo y ficha.",
    recommendedFor: "Tiendas de productos variados: hogar, herramientas, accesorios, etc.",
    structure: [
      "Home: hero + beneficios genéricos + categorías + novedades + ofertas",
      "Catálogo: grilla estándar con filtros de categoría y orden",
      "Ficha: galería + compra, bloques del producto (orden del admin), reseñas, relacionados",
    ],
  },
  "wellness-supplements": {
    id: "wellness-supplements",
    name: "Bienestar y suplementos",
    description:
      "Experiencia editorial orientada a rutina, confianza y bienestar. Prioriza visualmente el contenido real ya cargado — nunca inventa claims médicos, ingredientes ni certificaciones.",
    recommendedFor: "Suplementos, autocuidado y bienestar (ej. Vitanara).",
    structure: [
      "Home: foco en rutina/confianza + categorías de bienestar destacadas",
      "Catálogo: tarjetas más espaciosas y filtros por categoría en chips",
      "Ficha: galería + compra → beneficios → fórmula/uso → confianza (reseñas) → relacionados afines",
    ],
  },
};

export const STOREFRONT_THEME_LIST: StorefrontThemeDefinition[] = STOREFRONT_THEME_IDS.map(
  (id) => STOREFRONT_THEMES[id]
);

/**
 * Alias de ids legados (de la iteración anterior de este sistema, antes de
 * reducir a 2 temas bien terminados) hacia el id vigente equivalente. Un
 * tema legado que ya no existe (`technical`, `offer`) cae al default, igual
 * que cualquier valor desconocido.
 */
const LEGACY_THEME_ALIASES: Record<string, StorefrontThemeId> = {
  conversion: "conversion-general",
  wellness: "wellness-supplements",
};

/**
 * Resuelve un valor crudo de `store_settings.storefront_theme` (puede venir
 * vacío, `null`, o con un id legado/corrupto/eliminado) a un id de tema
 * válido. Nunca lanza — siempre cae a `conversion-general`, el mismo default
 * de la columna. No requiere migrar datos existentes: instalaciones viejas
 * con `storefront_theme = 'conversion'` o `'wellness'` siguen funcionando
 * igual vía este alias.
 */
export function resolveStorefrontTheme(raw: string | null | undefined): StorefrontThemeId {
  if (typeof raw === "string") {
    if ((STOREFRONT_THEME_IDS as readonly string[]).includes(raw)) {
      return raw as StorefrontThemeId;
    }
    const aliased = LEGACY_THEME_ALIASES[raw];
    if (aliased) return aliased;
  }
  return DEFAULT_STOREFRONT_THEME;
}
