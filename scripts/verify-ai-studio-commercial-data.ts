/**
 * Prueba pura (sin DB, sin red, sin R2, sin crear productos) de los datos
 * comerciales del Estudio IA de Producto (`lib/ai-product-studio/commercialData.ts`):
 * precio de venta, precio comparativo, stock, precio costo y URL de Dropi —
 * los campos que el admin completa a mano en el Paso 3 antes de "Aplicar al
 * borrador", nunca generados ni tocados por la IA.
 *
 * Cubre: precio obligatorio, comparativo opcional/menor-o-igual inválido,
 * stock 0 válido y negativo/decimal/texto inválido, costo opcional, URL de
 * Dropi válida/inválida (misma validación exacta de `lib/products/dropiLink.ts`),
 * y el mapeo correcto al payload que recibe `/admin/productos/nuevo`.
 *
 * Uso: npx tsx scripts/verify-ai-studio-commercial-data.ts
 */
import {
  commercialDataToFormPatch,
  validateCommercialData,
  type CommercialFormInput,
} from "../lib/ai-product-studio/commercialData";

let failures = 0;
function assert(condition: unknown, message: string): void {
  if (condition) {
    console.log(`  OK: ${message}`);
  } else {
    failures += 1;
    console.error(`  FALLO: ${message}`);
  }
}

function input(overrides: Partial<CommercialFormInput> = {}): CommercialFormInput {
  return {
    price: "",
    compareAtPrice: "",
    stock: "0",
    costPrice: "",
    dropiProductUrl: "",
    ...overrides,
  };
}

// ── [1] Precio obligatorio ───────────────────────────────────────────────────
console.log("[1] Precio de venta es obligatorio");
{
  const r1 = validateCommercialData(input({ price: "" }));
  assert(!r1.ok, "precio vacío -> inválido");
  assert(!r1.ok && r1.errors.some((e) => e.field === "price"), "el error apunta al campo price");

  const r2 = validateCommercialData(input({ price: "   " }));
  assert(!r2.ok, "precio solo espacios -> inválido (se recorta antes de validar)");

  const r3 = validateCommercialData(input({ price: "0" }));
  assert(!r3.ok, "precio 0 -> inválido (debe ser positivo, no solo no-negativo)");

  const r4 = validateCommercialData(input({ price: "49990" }));
  assert(r4.ok, "precio entero positivo -> válido");
  assert(r4.ok && r4.data.price === 49990, "precio se parsea al número correcto");
}

// ── [2] Precio comparativo vacío es válido (opcional) ────────────────────────
console.log("\n[2] Precio comparativo vacío es válido");
{
  const r = validateCommercialData(input({ price: "10000", compareAtPrice: "" }));
  assert(r.ok, "comparativo vacío junto a precio válido -> válido");
  assert(r.ok && r.data.compareAtPrice === null, "comparativo vacío se mapea a null, no a 0");
}

// ── [3] Comparativo menor o igual al precio de venta es inválido ─────────────
console.log("\n[3] Comparativo <= precio de venta es inválido");
{
  const rEqual = validateCommercialData(input({ price: "10000", compareAtPrice: "10000" }));
  assert(!rEqual.ok, "comparativo igual al precio -> inválido");
  assert(
    !rEqual.ok && rEqual.errors.some((e) => e.field === "compareAtPrice"),
    "el error apunta al campo compareAtPrice (caso igual)"
  );

  const rLess = validateCommercialData(input({ price: "10000", compareAtPrice: "9999" }));
  assert(!rLess.ok, "comparativo menor al precio -> inválido");

  const rGreater = validateCommercialData(input({ price: "10000", compareAtPrice: "15000" }));
  assert(rGreater.ok, "comparativo estrictamente mayor -> válido");
  assert(rGreater.ok && rGreater.data.compareAtPrice === 15000, "comparativo válido se parsea correctamente");
}

// ── [4] Stock 0 es válido ─────────────────────────────────────────────────────
console.log("\n[4] Stock 0 es válido");
{
  const r = validateCommercialData(input({ price: "10000", stock: "0" }));
  assert(r.ok, "stock 0 -> válido");
  assert(r.ok && r.data.stock === 0, "stock 0 se parsea correctamente (no confundido con vacío)");
}

// ── [5] Stock negativo, decimal o texto es inválido ───────────────────────────
console.log("\n[5] Stock negativo, decimal o texto es inválido");
{
  const rNeg = validateCommercialData(input({ price: "10000", stock: "-5" }));
  assert(!rNeg.ok, "stock negativo -> inválido");
  assert(!rNeg.ok && rNeg.errors.some((e) => e.field === "stock"), "el error apunta al campo stock (negativo)");

  const rDecimal = validateCommercialData(input({ price: "10000", stock: "3.5" }));
  assert(!rDecimal.ok, "stock decimal -> inválido");

  const rText = validateCommercialData(input({ price: "10000", stock: "abc" }));
  assert(!rText.ok, "stock texto -> inválido");

  const rEmpty = validateCommercialData(input({ price: "10000", stock: "" }));
  assert(!rEmpty.ok, "stock vacío -> inválido (es obligatorio)");
}

// ── [6] Precio costo: opcional, entero positivo ───────────────────────────────
console.log("\n[6] Precio costo opcional, entero positivo");
{
  const rEmpty = validateCommercialData(input({ price: "10000", costPrice: "" }));
  assert(rEmpty.ok, "costo vacío -> válido");
  assert(rEmpty.ok && rEmpty.data.costPrice === null, "costo vacío se mapea a null");

  const rZero = validateCommercialData(input({ price: "10000", costPrice: "0" }));
  assert(!rZero.ok, "costo 0 -> inválido (debe ser positivo)");

  const rNeg = validateCommercialData(input({ price: "10000", costPrice: "-100" }));
  assert(!rNeg.ok, "costo negativo -> inválido");

  const rValid = validateCommercialData(input({ price: "10000", costPrice: "6000" }));
  assert(rValid.ok, "costo entero positivo -> válido");
  assert(rValid.ok && rValid.data.costPrice === 6000, "costo válido se parsea correctamente");
}

// ── [7] URL de Dropi válida e inválida ────────────────────────────────────────
console.log("\n[7] URL de Dropi: misma validación exacta de lib/products/dropiLink.ts");
{
  const rEmpty = validateCommercialData(input({ price: "10000", dropiProductUrl: "" }));
  assert(rEmpty.ok, "URL Dropi vacía -> válida (campo opcional)");
  assert(rEmpty.ok && rEmpty.data.dropiProductUrl === null, "URL vacía se mapea a null");

  const rValidCl = validateCommercialData(
    input({ price: "10000", dropiProductUrl: "https://app.dropi.cl/producto/123" })
  );
  assert(rValidCl.ok, "URL https://app.dropi.cl/... -> válida");
  assert(
    rValidCl.ok && rValidCl.data.dropiProductUrl === "https://app.dropi.cl/producto/123",
    "URL válida se conserva tal cual (normalizada por URL())"
  );

  const rValidCo = validateCommercialData(
    input({ price: "10000", dropiProductUrl: "https://app.dropi.co/producto/456" })
  );
  assert(rValidCo.ok, "URL https://app.dropi.co/... -> válida");

  const rHttp = validateCommercialData(
    input({ price: "10000", dropiProductUrl: "http://app.dropi.cl/producto/123" })
  );
  assert(!rHttp.ok, "URL http:// (sin TLS) -> inválida");

  const rOtherHost = validateCommercialData(
    input({ price: "10000", dropiProductUrl: "https://evil.example.com/producto/123" })
  );
  assert(!rOtherHost.ok, "host fuera de la lista permitida -> inválida");

  const rMalformed = validateCommercialData(input({ price: "10000", dropiProductUrl: "no-es-una-url" }));
  assert(!rMalformed.ok, "texto que no es una URL -> inválida");
}

// ── [8] Mapeo correcto al payload de /admin/productos/nuevo ──────────────────
console.log("\n[8] commercialDataToFormPatch mapea todos los campos al payload del formulario manual");
{
  const r = validateCommercialData(
    input({
      price: "49990",
      compareAtPrice: "79990",
      stock: "12",
      costPrice: "25000",
      dropiProductUrl: "https://app.dropi.cl/producto/abc",
    })
  );
  assert(r.ok, "combinación completa y válida de datos comerciales");
  if (r.ok) {
    const patch = commercialDataToFormPatch(r.data);
    assert(patch.price === "49990", `price mapeado como string: "49990" (obtuvo "${patch.price}")`);
    assert(
      patch.compare_at_price === "79990",
      `compare_at_price mapeado como string: "79990" (obtuvo "${patch.compare_at_price}")`
    );
    assert(patch.cost_price === "25000", `cost_price mapeado como string: "25000" (obtuvo "${patch.cost_price}")`);
    assert(patch.stock === "12", `stock mapeado como string: "12" (obtuvo "${patch.stock}")`);
    assert(
      patch.dropi_product_url === "https://app.dropi.cl/producto/abc",
      `dropi_product_url mapeado tal cual (obtuvo "${patch.dropi_product_url}")`
    );
  }

  // Campos opcionales ausentes -> strings vacíos, nunca "null"/"undefined" literales
  // (el form de /admin/productos/nuevo espera siempre string, nunca otro tipo).
  const rMinimal = validateCommercialData(input({ price: "10000", stock: "0" }));
  assert(rMinimal.ok, "combinación mínima (solo obligatorios) es válida");
  if (rMinimal.ok) {
    const patch = commercialDataToFormPatch(rMinimal.data);
    assert(patch.compare_at_price === "", 'compareAtPrice ausente -> compare_at_price: "" (nunca "null")');
    assert(patch.cost_price === "", 'costPrice ausente -> cost_price: "" (nunca "null")');
    assert(patch.dropi_product_url === "", 'dropiProductUrl ausente -> dropi_product_url: "" (nunca "null")');
    assert(patch.stock === "0", 'stock 0 se mapea como "0", no como "" (0 no es "vacío")');
  }
}

if (failures > 0) {
  console.error(`\n${failures} aserción(es) fallaron.`);
  process.exitCode = 1;
} else {
  console.log("\nTodas las aserciones pasaron. Prueba 100% pura: sin DB, sin red, sin R2, sin productos reales.");
  process.exitCode = 0;
}
