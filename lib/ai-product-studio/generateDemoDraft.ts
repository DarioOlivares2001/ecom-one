import type { ProductSection, ProductSectionList } from "@/lib/product/sections/types";
import { BENEFIT_ICONS, type BenefitIcon } from "@/lib/product/sections/types";
import {
  claimsToAvoidFor,
  escapeHtml,
  filterSupplierLines,
  isBulletLine,
  isQuestionLine,
  looksLikeGenericHeading,
  NAME_PLACEHOLDER,
  stripBulletPrefix,
  truncate,
} from "./textFilters";
import { slugify } from "./slugify";
import type { AIProductDraft, AIProductStudioInput, AIProductStudioTone } from "./schema";

/**
 * Generador local determinista ("modo demo") del Estudio IA de Producto.
 * No llama a ningún proveedor de IA — ver `generateAIDraft.ts` para la
 * generación real con OpenAI, que produce el mismo `AIProductDraft`.
 *
 * Reglas duras, deliberadamente estrictas:
 *  - NUNCA inventa materiales, medidas, certificaciones, garantías, stock ni
 *    promesas médicas. Todo el contenido "factual" (beneficios, párrafos de
 *    descripción) sale literalmente de `input.supplierText` — el generador
 *    solo reorganiza y da formato, no sintetiza hechos nuevos.
 *  - Filtra activamente del texto de origen lo que NO debe llegar a la ficha
 *    (ver `textFilters.ts`): contacto/WhatsApp del proveedor, llamadas para
 *    confirmar stock, ofertas/descuentos, despacho de terceros, URLs
 *    externas, instrucciones administrativas y garantías ajenas a la tienda.
 *  - Nunca toma un encabezado genérico de sección ("Características
 *    destacadas", "Descripción", "Ficha técnica"...) como si fuera el
 *    nombre del producto. Si no encuentra un nombre confiable, usa el
 *    literal "Nombre por confirmar", nunca inventa uno.
 *  - Nunca genera `faq`, `testimonials` ni `before_after`: requerirían
 *    inventar preguntas/respuestas, reseñas de clientes o decidir qué imagen
 *    es "antes" y cuál "después" sin base real — fuera de alcance por
 *    diseño, no por omisión.
 *  - Determinista: mismos `input` + mismo `generatedAt` (inyectado por el
 *    caller, no por `Date.now()` interno) ⇒ siempre el mismo `AIProductDraft`.
 */

const MAX_NAME_LENGTH = 80;
const MAX_BENEFIT_ITEMS = 6;

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

export function generateDemoDraft(input: AIProductStudioInput, generatedAt: string): AIProductDraft {
  const { usableLines, ignoredSupplierLines } = filterSupplierLines(input.supplierText);
  const supplierTextLower = input.supplierText.toLowerCase();

  const bulletLines = usableLines.filter(isBulletLine).map(stripBulletPrefix).filter(Boolean);
  const questionLines = usableLines.filter((l) => !isBulletLine(l) && isQuestionLine(l));
  const proseLines = usableLines.filter((l) => !isBulletLine(l) && !isQuestionLine(l));

  const warnings: string[] = [
    "Modo demo: este borrador fue generado localmente, sin IA real. Revisa cada campo antes de guardar el producto.",
  ];
  const fieldsNeedingConfirmation: string[] = [];
  const detectedFacts: AIProductDraft["detectedFacts"] = [];

  // ── Nombre / slug — nunca un encabezado genérico de sección ────────────────
  const nameCandidate = proseLines.find((l) => !looksLikeGenericHeading(l));
  const name = nameCandidate ? truncate(nameCandidate, MAX_NAME_LENGTH) : NAME_PLACEHOLDER;
  const nameIsPlaceholder = name === NAME_PLACEHOLDER;
  if (nameIsPlaceholder) {
    fieldsNeedingConfirmation.push("name");
    warnings.push(
      'No se encontró una línea que pareciera un nombre de producto real (se descartaron encabezados genéricos como "Características destacadas"): queda "Nombre por confirmar".'
    );
  } else {
    detectedFacts.push({ claim: `Nombre detectado del texto: "${name}"`, source: "supplier_text" });
  }
  const slug = nameIsPlaceholder ? "" : slugify(name);
  if (!nameIsPlaceholder && !slug) fieldsNeedingConfirmation.push("slug");

  // ── Descripción (HTML simple, párrafos) ─────────────────────────────────────
  const descriptionSourceLines = proseLines.filter((l) => l !== nameCandidate);
  const paragraphs: string[] = [TONE_INTRO[input.tone]];
  if (input.commercialGoal?.trim()) {
    paragraphs.push(`Pensado especialmente para: ${escapeHtml(input.commercialGoal.trim())}.`);
  }
  for (const line of descriptionSourceLines) {
    paragraphs.push(escapeHtml(line));
    detectedFacts.push({ claim: line, source: "supplier_text" });
  }
  for (const bullet of bulletLines) {
    detectedFacts.push({ claim: bullet, source: "supplier_text" });
  }
  const descriptionHtml = paragraphs.map((p) => `<p>${p}</p>`).join("\n");

  // ── Categoría / tags: el modo demo nunca los infiere ────────────────────────
  const category = "";
  fieldsNeedingConfirmation.push("category");
  warnings.push('Categoría no inferida automáticamente: queda "por confirmar" para evitar adivinar el rubro.');
  const tags: string[] = [];

  // ── Galería: exactamente las imágenes elegidas por el usuario, en su orden ──
  const galleryImageUrls = [...input.selectedImages];

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
        image_url: galleryImageUrls[0] ?? "",
        items,
      },
    });
  } else {
    warnings.push("No se detectaron viñetas/listas en el texto del proveedor: no se generó la sección de Beneficios.");
  }

  if (galleryImageUrls.length >= 2) {
    sections.push({
      id: `demo-versatility-${order}`,
      type: "versatility",
      enabled: true,
      order: order++,
      data: {
        heading: "Versatilidad",
        image_url: galleryImageUrls[1],
      },
    });
  }

  if (galleryImageUrls.length >= 3) {
    sections.push({
      id: `demo-media-${order}`,
      type: "media_strip",
      enabled: true,
      order: order++,
      data: {
        image_url: galleryImageUrls[2],
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

  const productSections: ProductSectionList = sections;

  return {
    name,
    slug,
    category,
    tags,
    descriptionHtml,
    productSections,
    galleryImageUrls,
    detectedFacts,
    claimsToAvoid,
    fieldsNeedingConfirmation,
    ignoredSupplierLines,
    meta: {
      mode: "demo",
      generatedAt,
      warnings,
    },
  };
}
