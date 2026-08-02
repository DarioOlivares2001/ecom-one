import { Inter, Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";

export type FontRole = "heading" | "body";

type FontEntry = {
  /** CSS custom property (declarada por next/font vía `variable`) que resuelve al font-family real. */
  cssVar: string;
  /** className de next/font que hay que aplicar a un ancestro para que `cssVar` exista en el árbol. */
  className: string;
  roles: FontRole[];
};

/**
 * Único lugar donde se auto-hostean las fuentes de la tienda. Todas con
 * `preload: false`: el navegador solo descarga el archivo si el font-family
 * termina aplicado a texto realmente renderizado (vía --font-heading/--font-body
 * en buildThemeCssProperties), nunca por el solo hecho de estar declarado acá.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  preload: false,
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  preload: false,
});

const poppins = localFont({
  src: [
    { path: "../../app/fonts/poppins/400.woff2", weight: "400", style: "normal" },
    { path: "../../app/fonts/poppins/700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
  preload: false,
});

const montserrat = localFont({
  src: [{ path: "../../app/fonts/montserrat/variable.woff2", weight: "400 700", style: "normal" }],
  variable: "--font-montserrat",
  display: "swap",
  preload: false,
});

const nunito = localFont({
  src: [{ path: "../../app/fonts/nunito/variable.woff2", weight: "400 700", style: "normal" }],
  variable: "--font-nunito",
  display: "swap",
  preload: false,
});

const lato = localFont({
  src: [
    { path: "../../app/fonts/lato/400.woff2", weight: "400", style: "normal" },
    { path: "../../app/fonts/lato/700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-lato",
  display: "swap",
  preload: false,
});

const roboto = localFont({
  src: [{ path: "../../app/fonts/roboto/variable.woff2", weight: "400 700", style: "normal" }],
  variable: "--font-roboto",
  display: "swap",
  preload: false,
});

const playfairDisplay = localFont({
  src: [{ path: "../../app/fonts/playfair-display/variable.woff2", weight: "400 700", style: "normal" }],
  variable: "--font-playfair-display",
  display: "swap",
  preload: false,
});

const dmSans = localFont({
  src: [{ path: "../../app/fonts/dm-sans/variable.woff2", weight: "400 700", style: "normal" }],
  variable: "--font-dm-sans",
  display: "swap",
  preload: false,
});

const outfit = localFont({
  src: [{ path: "../../app/fonts/outfit/variable.woff2", weight: "400 700", style: "normal" }],
  variable: "--font-outfit",
  display: "swap",
  preload: false,
});

/**
 * Single source of truth: el admin (HEADING_FONTS/BODY_FONTS) y el storefront
 * (buildThemeCssProperties) leen de acá. Una fuente que no está en este objeto
 * no existe para la tienda, sin importar lo que diga `store_settings`.
 */
export const FONT_REGISTRY: Record<string, FontEntry> = {
  Inter: { cssVar: "--font-sans", className: inter.variable, roles: ["heading", "body"] },
  Poppins: { cssVar: "--font-poppins", className: poppins.variable, roles: ["heading", "body"] },
  Montserrat: { cssVar: "--font-montserrat", className: montserrat.variable, roles: ["heading", "body"] },
  Nunito: { cssVar: "--font-nunito", className: nunito.variable, roles: ["heading", "body"] },
  Lato: { cssVar: "--font-lato", className: lato.variable, roles: ["heading", "body"] },
  Roboto: { cssVar: "--font-roboto", className: roboto.variable, roles: ["heading", "body"] },
  "Playfair Display": {
    cssVar: "--font-playfair-display",
    className: playfairDisplay.variable,
    roles: ["heading"],
  },
  "Space Grotesk": { cssVar: "--font-display", className: spaceGrotesk.variable, roles: ["heading"] },
  "DM Sans": { cssVar: "--font-dm-sans", className: dmSans.variable, roles: ["heading", "body"] },
  Outfit: { cssVar: "--font-outfit", className: outfit.variable, roles: ["heading", "body"] },
};

/** classNames de todas las fuentes del registry, para aplicar en el ancestro que las va a usar. */
export const FONT_VARIABLE_CLASSNAME = Object.values(FONT_REGISTRY)
  .map((entry) => entry.className)
  .join(" ");

export function fontNamesForRole(role: FontRole): string[] {
  return Object.entries(FONT_REGISTRY)
    .filter(([, entry]) => entry.roles.includes(role))
    .map(([name]) => name);
}

/**
 * Resuelve un nombre guardado en store_settings al var() del registry.
 * Si el nombre no está en el registry (dato viejo, string arbitrario post-POST
 * directo, etc.) cae al fallback var — nunca a un font-family literal libre.
 */
export function resolveFontCssVar(name: string | undefined, fallbackVar: string): string {
  const entry = name ? FONT_REGISTRY[name] : undefined;
  return entry ? `var(${entry.cssVar})` : fallbackVar;
}
