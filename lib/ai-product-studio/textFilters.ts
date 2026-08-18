/**
 * Filtros de texto compartidos entre el generador demo (`generateDemoDraft.ts`)
 * y el generador real con OpenAI (`generateAIDraft.ts`). Puro, sin I/O.
 *
 * El filtrado de líneas ignorables corre SIEMPRE de forma determinística
 * ANTES de que el texto llegue a cualquier generador — incluido antes de
 * enviarlo a OpenAI. Esto es deliberado: no depende de que el modelo "se
 * porte bien" y decida no repetir un WhatsApp o una URL externa, la garantía
 * es arquitectónica (el dato nunca llega al prompt), el prompt solo refuerza
 * la misma regla como defensa en profundidad.
 */

export function truncate(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

const BULLET_PREFIX_RE = /^[-*•✓✔▪●○·]\s*/;

export function splitLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function isBulletLine(line: string): boolean {
  return BULLET_PREFIX_RE.test(line);
}

export function isQuestionLine(line: string): boolean {
  return line.endsWith("?");
}

export function stripBulletPrefix(line: string): string {
  return line.replace(BULLET_PREFIX_RE, "").trim();
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── Líneas a ignorar: nunca pasan a la ficha, ni siquiera al prompt de IA ────

interface IgnoreRule {
  category: string;
  test: (lineLower: string) => boolean;
}

const IGNORE_RULES: IgnoreRule[] = [
  {
    category: "Contacto/WhatsApp del proveedor",
    test: (l) =>
      l.includes("whatsapp") || l.includes("whats app") || /\+?56\s?9\s?\d{4}\s?\d{4}/.test(l) || /\b9\d{8}\b/.test(l),
  },
  {
    category: "Confirmación de stock/inventario",
    test: (l) =>
      /confirmar\s+stock|confirmar\s+inventario|consultar\s+disponibilidad|consultar\s+inventario|llamar\s+para\s+stock|stock\s+sujeto\s+a\s+confirmaci[oó]n/.test(
        l
      ),
  },
  {
    category: "Oferta/descuento del proveedor",
    test: (l) => /\boferta\b|\bdescuento\b|\bpromoci[oó]n\b|\bpromo\b|\b\d{1,3}%\s*off\b/.test(l),
  },
  {
    category: "Despacho/entrega de terceros",
    test: (l) =>
      /despacho\s+por|entrega\s+a\s+cargo\s+de|env[ií]a\s+directamente\s+el\s+proveedor|delivery\s+por\s+terceros|entrega\s+en\s+\d+\s*(horas?|d[ií]as?)/.test(
        l
      ),
  },
  {
    category: "URL externa",
    test: (l) => /https?:\/\/\S+|www\.\S+/.test(l),
  },
  {
    category: "Instrucción administrativa interna",
    test: (l) =>
      /c[oó]digo\s+interno|sku\s+proveedor|n[uú]mero\s+de\s+factura|adjuntar\s+boleta|enviar\s+a\s+bodega/.test(l),
  },
  {
    category: "Garantía ajena a la tienda",
    test: (l) => l.includes("garant"), // garantía/garantia/warranty (proveedor, Dropi, fabricante) — la tienda comunica la suya por su cuenta
  },
];

export function classifyIgnoredLine(line: string): string | null {
  const lower = line.toLowerCase();
  for (const rule of IGNORE_RULES) {
    if (rule.test(lower)) return rule.category;
  }
  return null;
}

/**
 * Separa un texto crudo en líneas "usables" (nada de ruido comercial) y
 * líneas ignoradas (con su categoría, para mostrar transparencia en la UI).
 * Ninguna línea ignorada llega jamás al resto del pipeline — ni al generador
 * demo, ni al prompt que se envía a OpenAI.
 */
export function filterSupplierLines(rawText: string): { usableLines: string[]; ignoredSupplierLines: string[] } {
  const rawLines = splitLines(rawText);
  const ignoredSupplierLines: string[] = [];
  const usableLines: string[] = [];
  for (const line of rawLines) {
    const category = classifyIgnoredLine(line);
    if (category) {
      ignoredSupplierLines.push(`${category}: "${truncate(line, 60)}"`);
    } else {
      usableLines.push(line);
    }
  }
  return { usableLines, ignoredSupplierLines };
}

// ─── Detección de nombre: nunca un encabezado genérico de sección ─────────────

const GENERIC_HEADING_PATTERNS = [
  /^caracter[ií]sticas?(\s+destacadas?|\s+principales?)?:?$/i,
  /^descripci[oó]n( del producto)?:?$/i,
  /^detalles?( del producto)?:?$/i,
  /^especificaciones?( t[eé]cnicas?)?:?$/i,
  /^beneficios?:?$/i,
  /^informaci[oó]n( del producto| general)?:?$/i,
  /^ficha t[eé]cnica:?$/i,
  /^producto:?$/i,
  /^resumen:?$/i,
  /^acerca de(l producto)?:?$/i,
  /^sobre (el|este) producto:?$/i,
];

export function looksLikeGenericHeading(line: string): boolean {
  if (GENERIC_HEADING_PATTERNS.some((re) => re.test(line.trim()))) return true;
  // Una línea corta que termina en ":" es casi siempre un encabezado de
  // sección, no el nombre de un producto — el nombre real no suele llevar ":".
  if (line.trim().endsWith(":") && line.length <= 60) return true;
  return false;
}

export const NAME_PLACEHOLDER = "Nombre por confirmar";

// ─── Categorías de afirmación a evitar si no están respaldadas en el texto ────

const RISK_KEYWORD_GROUPS: Record<string, string[]> = {
  materiales: ["material", "algodon", "algodón", "acero", "plastico", "plástico", "cuero", "madera", "aluminio", "silicona", "vidrio", "ceramica", "cerámica"],
  medidas: [" cm", " mm", " kg", " gr ", "gramos", "medida", "tamaño", "tamano", "dimension", "dimensión"],
  certificaciones: ["certifica", "iso ", "norma "],
  garantias: ["garantia", "garantía", "warranty"],
  potencia: ["watt", "vatio", " w ", "voltaje", "amperaje", " v ", "hz"],
};

export function claimsToAvoidFor(supplierTextLower: string): string[] {
  const claims: string[] = [];
  for (const [category, keywords] of Object.entries(RISK_KEYWORD_GROUPS)) {
    if (!keywords.some((k) => supplierTextLower.includes(k))) {
      claims.push(`${category}: no mencionado en el texto de origen — no reclamar nada al respecto.`);
    }
  }
  return claims;
}
