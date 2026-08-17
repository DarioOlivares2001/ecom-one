import type { ProductSection, ProductSectionList } from "@/lib/product/sections/types";
import { BENEFIT_ICONS, type BenefitIcon } from "@/lib/product/sections/types";
import type { AIProductDraft, AIProductStudioInput, AIProductStudioTone } from "./schema";

/**
 * Generador local determinista ("modo demo") del Estudio IA de Producto.
 *
 * Reglas duras, deliberadamente estrictas:
 *  - NUNCA inventa materiales, medidas, certificaciones, garantías, stock ni
 *    promesas médicas. Todo el contenido "factual" (beneficios, párrafos de
 *    descripción) sale literalmente de `input.supplierText` — el generador
 *    solo reorganiza y da formato, no sintetiza hechos nuevos.
 *  - Filtra activamente del texto de origen lo que NO debe llegar a la ficha:
 *    contacto/WhatsApp del proveedor, llamadas para confirmar stock, ofertas/
 *    descuentos, despacho de terceros, URLs externas, instrucciones
 *    administrativas y garantías ajenas a la tienda (ver `IGNORE_RULES`).
 *  - Nunca toma un encabezado genérico de sección ("Características
 *    destacadas", "Descripción", "Ficha técnica"...) como si fuera el
 *    nombre del producto — ver `looksLikeGenericHeading`. Si no encuentra un
 *    nombre confiable, usa el literal "Nombre por confirmar", nunca inventa
 *    uno.
 *  - El único texto que el generador SÍ aporta por sí mismo son frases de
 *    tono/estilo (una intro según `tone`), que son puramente de redacción,
 *    no afirmaciones sobre el producto.
 *  - Nunca genera `faq`, `testimonials` ni `before_after`: requerirían
 *    inventar preguntas/respuestas, reseñas de clientes o decidir qué imagen
 *    es "antes" y cuál "después" sin base real — fuera de alcance del modo
 *    demo por diseño, no por omisión.
 *  - Determinista: mismos `input` + mismo `generatedAt` (inyectado por el
 *    caller, no por `Date.now()` interno) ⇒ siempre el mismo `AIProductDraft`.
 */

const MAX_NAME_LENGTH = 80;
const MAX_META_TITLE_LENGTH = 70;
const MAX_META_DESC_LENGTH = 160;
const MAX_BENEFIT_ITEMS = 6;
const NAME_PLACEHOLDER = "Nombre por confirmar";

// ─── Utilidades de texto puras ────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function truncate(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

const BULLET_PREFIX_RE = /^[-*•✓✔▪●○·]\s*/;

function splitLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function isBulletLine(line: string): boolean {
  return BULLET_PREFIX_RE.test(line);
}

function isQuestionLine(line: string): boolean {
  return line.endsWith("?");
}

function stripBulletPrefix(line: string): string {
  return line.replace(BULLET_PREFIX_RE, "").trim();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── Líneas a ignorar: nunca pasan a la ficha, pero se registran para transparencia ──

interface IgnoreRule {
  category: string;
  test: (lineLower: string) => boolean;
}

const IGNORE_RULES: IgnoreRule[] = [
  {
    category: "Contacto/WhatsApp del proveedor",
    test: (l) => l.includes("whatsapp") || l.includes("whats app") || /\+?56\s?9\s?\d{4}\s?\d{4}/.test(l) || /\b9\d{8}\b/.test(l),
  },
  {
    category: "Llamada para confirmar stock",
    test: (l) => /confirmar\s+stock|consultar\s+disponibilidad|llamar\s+para\s+stock|stock\s+sujeto\s+a\s+confirmaci[oó]n/.test(l),
  },
  {
    category: "Oferta/descuento del proveedor",
    test: (l) => /\boferta\b|\bdescuento\b|\bpromoci[oó]n\b|\bpromo\b|\b\d{1,3}%\s*off\b/.test(l),
  },
  {
    category: "Despacho/entrega de terceros",
    test: (l) => /despacho\s+por|entrega\s+a\s+cargo\s+de|env[ií]a\s+directamente\s+el\s+proveedor|delivery\s+por\s+terceros/.test(l),
  },
  {
    category: "URL externa",
    test: (l) => /https?:\/\/\S+|www\.\S+/.test(l),
  },
  {
    category: "Instrucción administrativa interna",
    test: (l) => /c[oó]digo\s+interno|sku\s+proveedor|n[uú]mero\s+de\s+factura|adjuntar\s+boleta|enviar\s+a\s+bodega/.test(l),
  },
  {
    category: "Garantía ajena a la tienda",
    test: (l) => l.includes("garant"), // garantía/garantia/warranty del proveedor — la tienda comunica la suya por su cuenta
  },
];

function classifyLine(line: string): string | null {
  const lower = line.toLowerCase();
  for (const rule of IGNORE_RULES) {
    if (rule.test(lower)) return rule.category;
  }
  return null;
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

function looksLikeGenericHeading(line: string): boolean {
  if (GENERIC_HEADING_PATTERNS.some((re) => re.test(line.trim()))) return true;
  // Una línea corta que termina en ":" es casi siempre un encabezado de
  // sección, no el nombre de un producto — el nombre real no suele llevar ":".
  if (line.trim().endsWith(":") && line.length <= 60) return true;
  return false;
}

// ─── Tono ─────────────────────────────────────────────────────────────────────

const TONE_INTRO: Record<AIProductStudioTone, string> = {
  directo: "Lo esencial, sin vueltas: esto es lo que ofrece este producto.",
  confiable: "Un producto pensado para acompañarte con seguridad, día a día.",
  premium: "Una selección cuidada, con atención al detalle en cada aspecto.",
  practico: "Simple, funcional y listo para resolver el uso diario.",
};

const TONE_MEDIA_CAPTION: Record<AIProductStudioTone, string> = {
  directo: "Así se ve en uso.",
  confiable: "Pensado para durar.",
  premium: "Cada detalle cuenta.",
  practico: "Listo para el día a día.",
};

// ─── Categorías de afirmación a evitar (no mencionadas en el texto de origen) ──

const RISK_KEYWORD_GROUPS: Record<string, string[]> = {
  materiales: ["material", "algodon", "algodón", "acero", "plastico", "plástico", "cuero", "madera", "aluminio", "silicona", "vidrio", "ceramica", "cerámica"],
  medidas: [" cm", " mm", " kg", " gr ", "gramos", "medida", "tamaño", "tamano", "dimension", "dimensión"],
  certificaciones: ["certifica", "iso ", "norma "],
  garantias: ["garantia", "garantía", "warranty"],
  potencia: ["watt", "vatio", " w ", "voltaje", "amperaje", " v ", "hz"],
};

function containsKeyword(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function claimsToAvoidFor(supplierTextLower: string): string[] {
  const claims: string[] = [];
  for (const [category, keywords] of Object.entries(RISK_KEYWORD_GROUPS)) {
    if (!containsKeyword(supplierTextLower, keywords)) {
      claims.push(
        `${category}: no mencionado en el texto de origen — no reclamar nada al respecto.`
      );
    }
  }
  return claims;
}

// ─── Beneficios a partir de viñetas reales del texto ──────────────────────────

function benefitIconForIndex(i: number): BenefitIcon {
  return BENEFIT_ICONS[i % BENEFIT_ICONS.length];
}

function bulletToBenefitCard(bullet: string, index: number): { icon: BenefitIcon; title: string; description: string } {
  const colonIdx = bullet.indexOf(":");
  if (colonIdx > 0 && colonIdx < bullet.length - 1) {
    const title = truncate(bullet.slice(0, colonIdx), 60);
    const description = truncate(bullet.slice(colonIdx + 1), 240);
    return { icon: benefitIconForIndex(index), title, description: description || title };
  }
  const words = bullet.split(/\s+/);
  const title = truncate(words.slice(0, 5).join(" "), 60);
  return { icon: benefitIconForIndex(index), title, description: truncate(bullet, 240) };
}

// ─── Generador principal ──────────────────────────────────────────────────────

export function generateDemoDraft(input: AIProductStudioInput, generatedAt: string): AIProductDraft {
  const rawLines = splitLines(input.supplierText);
  const supplierTextLower = input.supplierText.toLowerCase();

  // ── Filtrado: separar líneas útiles de líneas a ignorar ────────────────────
  const ignoredSupplierLines: string[] = [];
  const usableLines: string[] = [];
  for (const line of rawLines) {
    const category = classifyLine(line);
    if (category) {
      ignoredSupplierLines.push(`${category}: "${truncate(line, 60)}"`);
    } else {
      usableLines.push(line);
    }
  }

  const bulletLines = usableLines.filter(isBulletLine).map(stripBulletPrefix).filter(Boolean);
  const questionLines = usableLines.filter((l) => !isBulletLine(l) && isQuestionLine(l));
  const proseLines = usableLines.filter((l) => !isBulletLine(l) && !isQuestionLine(l));

  const warnings: string[] = [
    "Modo demo: este borrador fue generado localmente, sin IA real. Revisa cada campo antes de guardar el producto.",
  ];
  const pendingFields: string[] = [];
  const detectedFacts: string[] = [];

  // ── Nombre / slug — nunca un encabezado genérico de sección ────────────────
  const nameCandidate = proseLines.find((l) => !looksLikeGenericHeading(l));
  const name = nameCandidate ? truncate(nameCandidate, MAX_NAME_LENGTH) : NAME_PLACEHOLDER;
  const nameIsPlaceholder = name === NAME_PLACEHOLDER;
  if (nameIsPlaceholder) {
    pendingFields.push("name");
    warnings.push(
      'No se encontró una línea que pareciera un nombre de producto real (se descartaron encabezados genéricos como "Características destacadas"): queda "Nombre por confirmar".'
    );
  } else {
    detectedFacts.push(`Nombre detectado del texto: "${name}"`);
  }
  const slug = nameIsPlaceholder ? "" : slugify(name);
  if (!nameIsPlaceholder && !slug) pendingFields.push("slug");

  // ── Descripción (HTML simple, párrafos) ─────────────────────────────────────
  const descriptionSourceLines = proseLines.filter((l) => l !== nameCandidate);
  const paragraphs: string[] = [TONE_INTRO[input.tone]];
  if (input.commercialGoal?.trim()) {
    paragraphs.push(`Pensado especialmente para: ${escapeHtml(input.commercialGoal.trim())}.`);
  }
  for (const line of descriptionSourceLines) {
    paragraphs.push(escapeHtml(line));
    detectedFacts.push(line);
  }
  for (const bullet of bulletLines) {
    detectedFacts.push(bullet);
  }
  const description = paragraphs.map((p) => `<p>${p}</p>`).join("\n");

  // ── Meta título / descripción ───────────────────────────────────────────────
  const meta_title = nameIsPlaceholder ? "" : truncate(name, MAX_META_TITLE_LENGTH);
  if (!meta_title) pendingFields.push("meta_title");
  const plainDescription = stripHtml(description);
  const meta_desc = plainDescription ? truncate(plainDescription, MAX_META_DESC_LENGTH) : "";
  if (!meta_desc) pendingFields.push("meta_desc");

  // ── Categoría / tags: el modo demo nunca los infiere ────────────────────────
  const category = "";
  pendingFields.push("category");
  warnings.push('Categoría no inferida automáticamente: queda "por confirmar" para evitar adivinar el rubro.');
  const tags: string[] = [];

  // ── Galería: exactamente las imágenes elegidas por el usuario, en su orden ──
  const images = [...input.selectedImages];

  // ── Bloques modulares ────────────────────────────────────────────────────────
  const sections: ProductSection[] = [];
  let order = 0;

  if (bulletLines.length > 0) {
    const items = bulletLines.slice(0, MAX_BENEFIT_ITEMS).map((b, i) => bulletToBenefitCard(b, i));
    sections.push({
      id: `demo-benefits-${order}`,
      type: "benefits",
      enabled: true,
      order: order++,
      data: {
        heading: "Beneficios",
        image_url: images[0] ?? "",
        items,
      },
    });
  } else {
    warnings.push("No se detectaron viñetas/listas en el texto del proveedor: no se generó la sección de Beneficios.");
  }

  if (images.length >= 2) {
    sections.push({
      id: `demo-versatility-${order}`,
      type: "versatility",
      enabled: true,
      order: order++,
      data: {
        heading: "Versatilidad",
        image_url: images[1],
      },
    });
  }

  if (images.length >= 3) {
    sections.push({
      id: `demo-media-${order}`,
      type: "media_strip",
      enabled: true,
      order: order++,
      data: {
        image_url: images[2],
        caption: TONE_MEDIA_CAPTION[input.tone],
        aspect: "16/9",
      },
    });
  }

  warnings.push(
    "No se generan preguntas frecuentes, testimonios ni comparador antes/después en modo demo: requerirían inventar respuestas, reseñas o decidir qué imagen es \"antes\"/\"después\" sin información real."
  );
  if (questionLines.length > 0) {
    warnings.push(
      `El texto del proveedor incluye ${questionLines.length} pregunta(s) (posible FAQ) — agrégalas manualmente con su respuesta real en el bloque "Preguntas frecuentes".`
    );
  }

  const claimsToAvoid = claimsToAvoidFor(supplierTextLower);

  const product_sections: ProductSectionList = sections;

  return {
    name,
    slug,
    description,
    meta_title,
    meta_desc,
    category,
    tags,
    images,
    product_sections,
    meta: {
      mode: "demo",
      generatedAt,
      warnings,
      pendingFields,
      detectedFacts,
      claimsToAvoid,
      ignoredSupplierLines,
    },
  };
}
