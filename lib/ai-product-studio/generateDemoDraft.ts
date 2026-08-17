import type { ProductSection, ProductSectionList } from "@/lib/product/sections/types";
import { BENEFIT_ICONS, type BenefitIcon } from "@/lib/product/sections/types";
import type { AIProductDraft, AIProductStudioInput, AIProductStudioTone } from "./schema";

/**
 * Generador local determinista ("modo demo") del Estudio IA de Producto.
 *
 * Reglas duras, deliberadamente estrictas:
 *  - NUNCA inventa materiales, medidas, certificaciones, garantías, stock ni
 *    promesas médicas/de salud. Todo el contenido "factual" (beneficios,
 *    párrafos de descripción) sale literalmente de `input.supplierText` —
 *    el generador solo reorganiza y da formato, no sintetiza hechos nuevos.
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

// ─── Detección de riesgo de invención (solo para advertencias, nunca genera contenido) ──

const RISK_KEYWORD_GROUPS: Record<string, string[]> = {
  materiales: ["material", "algodon", "algodón", "acero", "plastico", "plástico", "cuero", "madera", "aluminio", "silicona", "vidrio", "ceramica", "cerámica"],
  medidas: [" cm", " mm", " kg", " gr ", "gramos", "medida", "tamaño", "tamano", "dimension", "dimensión"],
  certificaciones: ["certifica", "iso ", "norma "],
  garantias: ["garantia", "garantía", "warranty"],
};

function containsKeyword(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function riskCategoryWarnings(supplierTextLower: string): string[] {
  const warnings: string[] = [];
  for (const [category, keywords] of Object.entries(RISK_KEYWORD_GROUPS)) {
    if (!containsKeyword(supplierTextLower, keywords)) {
      warnings.push(
        `El texto del proveedor no menciona "${category}": no se inventó nada al respecto, revisa y agrega manualmente si corresponde.`
      );
    }
  }
  return warnings;
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
  const lines = splitLines(input.supplierText);
  const supplierTextLower = input.supplierText.toLowerCase();

  const bulletLines = lines.filter(isBulletLine).map(stripBulletPrefix).filter(Boolean);
  const questionLines = lines.filter((l) => !isBulletLine(l) && isQuestionLine(l));
  const proseLines = lines.filter((l) => !isBulletLine(l) && !isQuestionLine(l));

  const warnings: string[] = [
    "Modo demo: este borrador fue generado localmente, sin IA real. Revisa cada campo antes de guardar el producto.",
  ];
  const pendingFields: string[] = [];

  // ── Nombre / slug ──────────────────────────────────────────────────────────
  const nameSource = proseLines[0] ?? bulletLines[0] ?? "";
  const name = nameSource ? truncate(nameSource, MAX_NAME_LENGTH) : "";
  if (!name) {
    pendingFields.push("name");
    warnings.push('No se encontró una primera línea utilizable como nombre: queda "por confirmar".');
  }
  const slug = name ? slugify(name) : "";
  if (name && !slug) pendingFields.push("slug");

  // ── Descripción (HTML simple, párrafos) ─────────────────────────────────────
  const descriptionSourceLines = proseLines.slice(name ? 1 : 0);
  const paragraphs: string[] = [TONE_INTRO[input.tone]];
  if (input.commercialGoal?.trim()) {
    paragraphs.push(`Pensado especialmente para: ${escapeHtml(input.commercialGoal.trim())}.`);
  }
  for (const line of descriptionSourceLines) {
    paragraphs.push(escapeHtml(line));
  }
  const description = paragraphs.map((p) => `<p>${p}</p>`).join("\n");

  // ── Meta título / descripción ───────────────────────────────────────────────
  const meta_title = name ? truncate(name, MAX_META_TITLE_LENGTH) : "";
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

  warnings.push(...riskCategoryWarnings(supplierTextLower));

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
    },
  };
}
