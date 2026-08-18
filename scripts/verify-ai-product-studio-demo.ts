/**
 * Prueba pura (sin DB, sin red, sin crear productos) del generador local
 * determinista del Estudio IA de Producto (Fase 1 — modo demo).
 *
 * Cubre: determinismo, validez contra el contrato Zod real (el mismo que
 * usa `products.product_sections`), las reglas duras de "no inventar", la
 * detección de nombre (nunca un encabezado genérico como "Características
 * destacadas"), y el filtrado de líneas ignorables (contacto/WhatsApp,
 * confirmación de stock, ofertas, despacho de terceros, URLs externas,
 * instrucciones administrativas, garantías ajenas a la tienda).
 *
 * Uso: npx tsx scripts/verify-ai-product-studio-demo.ts
 */
import { generateDemoDraft } from "../lib/ai-product-studio/generateDemoDraft";
import { aiProductDraftSchema, aiProductStudioInputSchema, type AIProductStudioInput } from "../lib/ai-product-studio/schema";

let failures = 0;
function assert(condition: unknown, message: string): void {
  if (condition) {
    console.log(`  OK: ${message}`);
  } else {
    failures += 1;
    console.error(`  FALLO: ${message}`);
  }
}

const IMG = (n: number) => `https://pub-test.r2.dev/products/test-${n}.webp`;
const FIXED_TIMESTAMP = "2026-01-01T00:00:00.000Z";

// ── [1] Determinismo ───────────────────────────────────────────────────────
console.log("[1] Determinismo: mismo input + mismo timestamp -> mismo output");
{
  const input: AIProductStudioInput = {
    supplierText: "Mochila urbana resistente\n- Bolsillo acolchado para laptop\n- Correas ajustables\n- Cierre reforzado",
    selectedImages: [IMG(1), IMG(2), IMG(3)],
    commercialGoal: "aumentar conversión en mobile",
    tone: "directo",
  };
  const a = generateDemoDraft(input, FIXED_TIMESTAMP);
  const b = generateDemoDraft(input, FIXED_TIMESTAMP);
  assert(JSON.stringify(a) === JSON.stringify(b), "dos llamadas idénticas producen JSON idéntico");
}

// ── [2] Validez contra el contrato real ─────────────────────────────────────
console.log("\n[2] El borrador generado siempre valida contra aiProductDraftSchema");
{
  const cases: Array<{ label: string; input: AIProductStudioInput }> = [
    {
      label: "texto con viñetas, 3 imágenes, tono premium",
      input: {
        supplierText: "Set de tazas de cerámica\n- Apto microondas\n- Diseño minimalista\n¿Vienen en caja de regalo?",
        selectedImages: [IMG(1), IMG(2), IMG(3)],
        tone: "premium",
      },
    },
    {
      label: "texto sin viñetas, 1 sola imagen, tono práctico",
      input: {
        supplierText: "Organizador de escritorio de bambú, fácil de limpiar.",
        selectedImages: [IMG(1)],
        tone: "practico",
      },
    },
    {
      label: "texto con objetivo comercial, tono confiable, 2 imágenes",
      input: {
        supplierText: "Lámpara LED de mesa\n- Luz cálida regulable",
        selectedImages: [IMG(1), IMG(2)],
        commercialGoal: "destacar como regalo de oficina",
        tone: "confiable",
      },
    },
    {
      label: "solo encabezados genéricos, sin nombre real (regresión reportada)",
      input: {
        supplierText: "Características destacadas\n- Punto uno\n- Punto dos",
        selectedImages: [IMG(1)],
        tone: "directo",
      },
    },
  ];

  for (const { label, input } of cases) {
    const parsedInput = aiProductStudioInputSchema.safeParse(input);
    assert(parsedInput.success, `[${label}] input válido contra aiProductStudioInputSchema`);
    if (!parsedInput.success) continue;
    const draft = generateDemoDraft(parsedInput.data, FIXED_TIMESTAMP);
    const parsedDraft = aiProductDraftSchema.safeParse(draft);
    assert(parsedDraft.success, `[${label}] borrador válido contra aiProductDraftSchema`);
    if (!parsedDraft.success) console.error(parsedDraft.error.issues);
  }
}

// ── [2b] Regresión exacta reportada: "Características destacadas" como nombre ─
console.log('\n[2b] Regresión: "Características destacadas" nunca se usa como nombre');
{
  const draft = generateDemoDraft(
    {
      supplierText: "Características destacadas\n- Resistente al agua\n- Liviano\n- Fácil de transportar",
      selectedImages: [IMG(1)],
      tone: "directo",
    },
    FIXED_TIMESTAMP
  );
  assert(draft.name === "Nombre por confirmar", `nombre = "Nombre por confirmar" (obtuvo: "${draft.name}")`);
  assert(draft.slug === "", "slug vacío cuando el nombre es el placeholder");
  assert(draft.fieldsNeedingConfirmation.includes("name"), "name queda en fieldsNeedingConfirmation");

  const draftWithRealName = generateDemoDraft(
    {
      supplierText: "Mochila Urbana Resistente\nCaracterísticas destacadas\n- Resistente al agua\n- Liviano",
      selectedImages: [IMG(1)],
      tone: "directo",
    },
    FIXED_TIMESTAMP
  );
  assert(
    draftWithRealName.name === "Mochila Urbana Resistente",
    `con una línea de nombre real ANTES del encabezado genérico, se detecta correctamente (obtuvo: "${draftWithRealName.name}")`
  );
}

// ── [3] Reglas duras de "no inventar" ───────────────────────────────────────
console.log("\n[3] No inventa materiales/medidas/certificaciones/garantías/stock/promesas médicas");
{
  const input: AIProductStudioInput = {
    supplierText: "Cojín Decorativo Redondo\n- Relleno suave\n- Colores disponibles: gris y beige",
    selectedImages: [IMG(1)],
    tone: "directo",
  };
  const draft = generateDemoDraft(input, FIXED_TIMESTAMP);
  const fullText = `${draft.name} ${draft.descriptionHtml}`.toLowerCase();

  const forbiddenIfAbsentFromSource = ["algodón", "algodon", "acero", "iso 9001", "garantía de por vida", "certificado", "cura", "trata", "alivia"];
  for (const term of forbiddenIfAbsentFromSource) {
    assert(!fullText.includes(term), `no aparece "${term}" (no estaba en el texto de origen)`);
  }
  assert(draft.category === "", "category nunca se infiere en modo demo (queda vacía)");
  assert(draft.tags.length === 0, "tags nunca se infieren en modo demo (queda vacío)");
  assert(draft.fieldsNeedingConfirmation.includes("category"), 'category se marca "por confirmar" en fieldsNeedingConfirmation');
  assert(
    !("stock" in draft) && !("price" in draft),
    "el contrato de salida no incluye price/stock: el estudio no puede tocarlos"
  );
  assert(draft.claimsToAvoid.some((c) => c.startsWith("materiales:")), "claimsToAvoid marca materiales como no mencionados");
}

console.log("\n[3b] Nunca genera testimonios, FAQ ni comparador antes/después");
{
  const input: AIProductStudioInput = {
    supplierText:
      "Zapatillas Urbanas\n- Suela antideslizante\n- Plantilla removible\n¿Qué talla debería elegir?\n¿Tienen garantía?",
    selectedImages: [IMG(1), IMG(2), IMG(3)],
    tone: "confiable",
  };
  const draft = generateDemoDraft(input, FIXED_TIMESTAMP);
  const types = draft.productSections.map((s) => s.type);
  assert(!types.includes("testimonials"), "nunca genera sección de testimonios");
  assert(!types.includes("faq"), "nunca genera sección de FAQ (aunque el texto tenga preguntas)");
  assert(!types.includes("before_after"), "nunca genera comparador antes/después");
  assert(
    draft.meta.warnings.some((w) => w.toLowerCase().includes("pregunta")),
    "avisa en warnings que detectó preguntas para completar manualmente"
  );
}

// ── [3c] Filtrado de líneas ignorables ──────────────────────────────────────
console.log("\n[3c] Ignora contacto/stock/ofertas/despacho/URLs/administrativo/garantías del proveedor");
{
  const input: AIProductStudioInput = {
    supplierText: [
      "Set de Ollas Antiadherentes",
      "- Apto para todo tipo de cocinas",
      "- Mango ergonómico",
      "Escríbenos por WhatsApp al +56912345678 para más info",
      "Llamar para confirmar stock antes de comprar",
      "20% OFF por tiempo limitado",
      "Despacho por transportista externo, no la tienda",
      "Más fotos en https://proveedor-externo.cl/catalogo",
      "SKU proveedor: PX-88213",
      "Garantía del fabricante: 6 meses directamente con el proveedor",
    ].join("\n"),
    selectedImages: [IMG(1)],
    tone: "directo",
  };
  const draft = generateDemoDraft(input, FIXED_TIMESTAMP);
  const fullText = `${draft.descriptionHtml} ${JSON.stringify(draft.productSections)}`.toLowerCase();

  assert(!fullText.includes("whatsapp") && !fullText.includes("912345678"), "no incluye WhatsApp/teléfono del proveedor");
  assert(!fullText.includes("confirmar stock"), "no incluye la instrucción de llamar para confirmar stock");
  assert(!fullText.includes("off") && !fullText.includes("tiempo limitado"), "no incluye la oferta/descuento del proveedor");
  assert(!fullText.includes("transportista externo"), "no incluye la mención de despacho de terceros");
  assert(!fullText.includes("proveedor-externo.cl"), "no incluye la URL externa");
  assert(!fullText.includes("sku proveedor"), "no incluye la instrucción administrativa interna");
  assert(!fullText.includes("garantía del fabricante") && !fullText.includes("6 meses"), "no incluye la garantía ajena a la tienda");

  assert(draft.ignoredSupplierLines.length >= 7, `se registraron ${draft.ignoredSupplierLines.length} líneas ignoradas (>=7 esperado)`);
  assert(
    draft.ignoredSupplierLines.some((l) => l.startsWith("Contacto/WhatsApp")),
    "ignoredSupplierLines identifica la categoría Contacto/WhatsApp"
  );

  assert(fullText.includes("apto para todo tipo de cocinas"), "SÍ conserva contenido legítimo del producto (no sobre-filtra)");
}

// ── [4] Estructura de secciones depende de las imágenes/viñetas disponibles ──
console.log("\n[4] Secciones generadas dependen de imágenes/viñetas disponibles, nunca se inventan de más");
{
  const noBullets = generateDemoDraft(
    { supplierText: "Producto Sin Viñetas\nSolo una oración descriptiva.", selectedImages: [IMG(1)], tone: "directo" },
    FIXED_TIMESTAMP
  );
  assert(
    !noBullets.productSections.some((s) => s.type === "benefits"),
    "sin viñetas en el texto -> no genera sección de Beneficios"
  );

  const oneImage = generateDemoDraft(
    { supplierText: "Producto Con Viñetas\n- Punto uno\n- Punto dos", selectedImages: [IMG(1)], tone: "directo" },
    FIXED_TIMESTAMP
  );
  assert(
    !oneImage.productSections.some((s) => s.type === "versatility" || s.type === "media_strip"),
    "con 1 sola imagen -> no genera Versatilidad ni Imagen ancha (necesitan 2da/3ra imagen)"
  );

  const threeImages = generateDemoDraft(
    { supplierText: "Producto Con Viñetas\n- Punto uno\n- Punto dos", selectedImages: [IMG(1), IMG(2), IMG(3)], tone: "directo" },
    FIXED_TIMESTAMP
  );
  assert(
    threeImages.productSections.some((s) => s.type === "benefits") &&
      threeImages.productSections.some((s) => s.type === "versatility") &&
      threeImages.productSections.some((s) => s.type === "media_strip"),
    "con viñetas + 3 imágenes -> genera Beneficios + Versatilidad + Imagen ancha"
  );
  assert(
    threeImages.galleryImageUrls.length === 3 && threeImages.galleryImageUrls.every((u, i) => u === [IMG(1), IMG(2), IMG(3)][i]),
    "galleryImageUrls de salida = exactamente las selectedImages, en el mismo orden (nunca inventa URLs nuevas)"
  );
}

// ── [5] Input inválido se rechaza (nunca genera sin datos mínimos) ──────────
console.log("\n[5] El schema de entrada rechaza texto vacío o sin imágenes seleccionadas");
{
  assert(!aiProductStudioInputSchema.safeParse({ supplierText: "", selectedImages: [IMG(1)], tone: "directo" }).success, "texto vacío se rechaza");
  assert(!aiProductStudioInputSchema.safeParse({ supplierText: "algo", selectedImages: [], tone: "directo" }).success, "sin imágenes seleccionadas se rechaza");
  assert(!aiProductStudioInputSchema.safeParse({ supplierText: "algo", selectedImages: [IMG(1)], tone: "inventado" }).success, "tono fuera de la lista permitida se rechaza");
}

if (failures > 0) {
  console.error(`\n${failures} aserción(es) fallaron.`);
  process.exitCode = 1;
} else {
  console.log("\nTodas las aserciones pasaron. Ningún producto ni dato real fue tocado (script 100% puro, sin DB/red).");
  process.exitCode = 0;
}
