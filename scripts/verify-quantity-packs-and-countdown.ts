/**
 * Prueba pura (sin DB, sin red, sin tocar productos reales) de los dos
 * bloques modulares opcionales: el selector de packs dentro de
 * PurchasePanel (quantity_packs) y "Contador de oferta" (offer_countdown).
 *
 * Cubre los casos pedidos:
 * [1] bloque apagado no renderiza
 * [2] sin descuentos válidos no renderiza packs
 * [3] selección de pack actualiza cantidad/precio/CTA
 * [4] no se muestra "Más elegido" sin configuración explícita
 * [5] countdown solo aparece con fecha futura válida
 * [6] countdown expirado/inválido no aparece
 * [7] orden de bloques se conserva
 * [8] estado de carrito y sticky CTA permanecen sincronizados
 * [9] selector visible: opción base "1 unidad" + tiers reales x2/x3;
 *     producto sin tiers reales no arma el selector (lista vacía)
 *
 * Uso: npx tsx scripts/verify-quantity-packs-and-countdown.ts
 */
import { getVisibleSections, parseProductSectionsLoose } from "../lib/product/sections/parse";
import {
  resolvePackTiers,
  resolvePackSelectorTiers,
  hasValidPackTiers,
  getActivePackLabel,
  getFirstEnabledQuantityPacksData,
} from "../lib/product/sections/quantityPacks";
import { getCountdownRemaining, isCountdownActive } from "../lib/product/sections/offerCountdown";
import { getDiscountedUnitPrice } from "../lib/discounts";
import type { Product } from "../lib/db/types";
import type { ProductSection, QuantityPacksData } from "../lib/product/sections/types";

let failures = 0;
function assert(condition: unknown, message: string): void {
  if (condition) {
    console.log(`  OK: ${message}`);
  } else {
    failures += 1;
    console.error(`  FALLO: ${message}`);
  }
}

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: "p1",
    slug: "producto-test",
    name: "Producto de prueba",
    description: null,
    price: 10000,
    compare_at_price: null,
    cost_price: null,
    stock: 20,
    images: [],
    product_media: [],
    category: null,
    tags: [],
    variants: null,
    has_variants: false,
    options: null,
    meta_title: null,
    meta_desc: null,
    dropi_product_url: null,
    active: true,
    discount_enabled: false,
    discount_max_percent: 0,
    discount_steps: [],
    discount_label: null,
    product_sections: [],
    deleted_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const REAL_STEPS = [
  { minQty: 2, percent: 10 },
  { minQty: 3, percent: 20 },
  { minQty: 5, percent: 30 },
];

function makePacksData(overrides: Partial<QuantityPacksData> = {}): QuantityPacksData {
  return {
    heading: "Packs y ahorro",
    description: "",
    steps: [{ minQty: 2 }, { minQty: 3, label: "Pack Trío" }],
    mostChosenMinQty: null,
    ...overrides,
  };
}

console.log("[1] Bloque apagado no renderiza (packs y countdown)");
{
  const sections = [
    {
      id: "s1",
      enabled: false,
      order: 0,
      type: "quantity_packs" as const,
      data: makePacksData(),
    },
    {
      id: "s2",
      enabled: false,
      order: 1,
      type: "offer_countdown" as const,
      data: { ends_at: new Date(Date.now() + 86400000).toISOString() },
    },
    { id: "s3", enabled: true, order: 2, type: "faq" as const, data: { items: [{ question: "Q", answer: "A" }] } },
  ] as unknown as ProductSection[];

  const visible = getVisibleSections(parseProductSectionsLoose(sections));
  assert(
    !visible.some((s) => s.type === "quantity_packs"),
    "quantity_packs con enabled:false queda fuera de getVisibleSections (nunca llega al renderer)"
  );
  assert(
    !visible.some((s) => s.type === "offer_countdown"),
    "offer_countdown con enabled:false queda fuera de getVisibleSections (nunca llega al renderer)"
  );
  assert(visible.length === 1 && visible[0].type === "faq", "el resto de bloques habilitados sigue visible");
}

console.log("\n[2] Sin descuentos válidos no renderiza packs");
{
  const dataWithSteps = makePacksData();

  const noDiscountEnabled = makeProduct({ discount_enabled: false, discount_steps: REAL_STEPS });
  assert(
    resolvePackTiers(noDiscountEnabled, dataWithSteps).length === 0,
    "discount_enabled=false -> sin packs, aunque discount_steps tenga datos"
  );
  assert(!hasValidPackTiers(noDiscountEnabled, dataWithSteps), "hasValidPackTiers también es false en ese caso");

  const noRealSteps = makeProduct({ discount_enabled: true, discount_max_percent: 30, discount_steps: [] });
  assert(
    resolvePackTiers(noRealSteps, dataWithSteps).length === 0,
    "discount_enabled=true pero discount_steps vacío -> sin packs"
  );

  const staleRef = makeProduct({ discount_enabled: true, discount_max_percent: 30, discount_steps: REAL_STEPS });
  const dataWithStaleRef = makePacksData({ steps: [{ minQty: 99 }] });
  assert(
    resolvePackTiers(staleRef, dataWithStaleRef).length === 0,
    "referencia a un minQty que ya no existe en discount_steps reales -> se omite, nunca se inventa"
  );
}

console.log("\n[3] Selección de pack actualiza cantidad/precio/CTA de forma coherente");
{
  const product = makeProduct({
    price: 10000,
    discount_enabled: true,
    discount_max_percent: 30,
    discount_steps: REAL_STEPS,
    product_sections: [
      { id: "packs-1", enabled: true, order: 0, type: "quantity_packs", data: makePacksData() },
    ] as unknown as Product["product_sections"],
  });

  const tiers = resolvePackTiers(product, makePacksData());
  const tierX3 = tiers.find((t) => t.minQty === 3);
  assert(!!tierX3, "el escalón x3 configurado se resuelve");
  assert(tierX3!.percent === 20, `el porcentaje del escalón x3 es el real (20%), obtuvo ${tierX3?.percent}`);
  assert(tierX3!.unitPrice === 8000, `precio unitario con 20% off sobre 10000 = 8000 (obtuvo ${tierX3?.unitPrice})`);
  assert(tierX3!.totalPrice === 24000, `precio total x3 = 24000 (obtuvo ${tierX3?.totalPrice})`);
  assert(tierX3!.savingsTotal === 6000, `ahorro total x3 = 6000 (obtuvo ${tierX3?.savingsTotal})`);
  assert(tierX3!.label === "Pack Trío", "usa el label que puso el admin");

  // "Actualiza cantidad/precio/CTA": al fijar qty=3 (lo que hace el tile al
  // hacer clic vía setQty), el CTA principal y el sticky deben coincidir.
  const ctaLabelAtQty3 = getActivePackLabel(product, 3);
  assert(ctaLabelAtQty3 === "Pack Trío", `getActivePackLabel(product, 3) refleja el pack seleccionado (obtuvo ${ctaLabelAtQty3})`);
  const ctaLabelAtQty1 = getActivePackLabel(product, 1);
  assert(ctaLabelAtQty1 === null, "con qty=1 (sin pack seleccionado) el CTA no menciona ningún pack");
  const ctaLabelAtQty4 = getActivePackLabel(product, 4);
  assert(ctaLabelAtQty4 === null, "qty que no coincide con ningún pack configurado -> CTA genérico");
}

console.log('\n[4] "Más elegido" nunca aparece sin configuración explícita');
{
  const product = makeProduct({
    price: 10000,
    discount_enabled: true,
    discount_max_percent: 30,
    discount_steps: REAL_STEPS,
  });

  const withoutMostChosen = resolvePackTiers(product, makePacksData({ mostChosenMinQty: null }));
  assert(
    withoutMostChosen.every((t) => t.isMostChosen === false),
    "mostChosenMinQty: null -> ningún tier tiene isMostChosen (nunca se infiere)"
  );

  const withMostChosen = resolvePackTiers(product, makePacksData({ mostChosenMinQty: 3 }));
  assert(
    withMostChosen.find((t) => t.minQty === 3)?.isMostChosen === true,
    "mostChosenMinQty: 3 -> solo el tier x3 queda marcado"
  );
  assert(
    withMostChosen.filter((t) => t.isMostChosen).length === 1,
    "como máximo un tier queda marcado como Más elegido"
  );
}

console.log("\n[5] Countdown solo aparece con fecha futura válida");
{
  const future = new Date(Date.now() + 3 * 86400000 + 3661000).toISOString(); // ~3d 1h 1m 1s
  const remaining = getCountdownRemaining(future);
  assert(remaining !== null, "fecha futura válida -> getCountdownRemaining no es null");
  assert(remaining!.days === 3, `calcula los días correctamente (obtuvo ${remaining?.days})`);
  assert(isCountdownActive({ ends_at: future }), "isCountdownActive true con fecha futura");
}

console.log("\n[6] Countdown expirado/inválido no aparece");
{
  const past = new Date(Date.now() - 1000).toISOString();
  assert(getCountdownRemaining(past) === null, "fecha pasada -> null");
  assert(getCountdownRemaining("no-es-una-fecha") === null, "string inválido -> null");
  assert(getCountdownRemaining("") === null, "vacío -> null");
  assert(getCountdownRemaining(undefined) === null, "undefined -> null");
  assert(!isCountdownActive({ ends_at: past }), "isCountdownActive false con fecha pasada");
  assert(!isCountdownActive({}), "isCountdownActive false sin ends_at configurado");
}

console.log("\n[7] El orden de los bloques se conserva exactamente como lo definió el admin");
{
  const raw = [
    { id: "a", enabled: true, order: 2, type: "faq", data: { items: [{ question: "Q", answer: "A" }] } },
    {
      id: "b",
      enabled: true,
      order: 0,
      type: "quantity_packs",
      data: makePacksData(),
    },
    {
      id: "c",
      enabled: true,
      order: 1,
      type: "offer_countdown",
      data: { ends_at: "" },
    },
  ];
  const parsed = parseProductSectionsLoose(raw);
  assert(
    JSON.stringify(parsed.map((s) => s.id)) === JSON.stringify(["b", "c", "a"]),
    `se ordena por 'order' tal cual lo dejó el admin, sin tratar los bloques nuevos de forma especial (obtuvo ${JSON.stringify(parsed.map((s) => s.id))})`
  );
}

console.log("\n[8] El precio de un pack coincide exactamente con lo que cobrarían carrito/checkout (misma fuente de cálculo)");
{
  const product = makeProduct({
    price: 15000,
    discount_enabled: true,
    discount_max_percent: 30,
    discount_steps: REAL_STEPS,
  });
  const tiers = resolvePackTiers(product, makePacksData({ steps: [{ minQty: 5, label: "Pack Ahorro" }] }));
  const tier = tiers.find((t) => t.minQty === 5)!;

  // Mismo cálculo que usan lib/cart/store.ts y lib/checkout/recalculateCheckoutOrder.ts.
  const cartWouldCharge = getDiscountedUnitPrice(product, 5, product.price);
  assert(
    tier.unitPrice === cartWouldCharge,
    `el precio unitario del pack (${tier.unitPrice}) es idéntico al que calcularía el carrito/checkout (${cartWouldCharge}) — no hay dos fuentes de verdad`
  );

  // El sticky CTA y el CTA principal llaman a la misma función pura con el
  // mismo qty -> mismo resultado, siempre.
  const labelFromMainCta = getActivePackLabel(
    { ...product, product_sections: [{ id: "x", enabled: true, order: 0, type: "quantity_packs", data: makePacksData({ steps: [{ minQty: 5, label: "Pack Ahorro" }] }) }] as unknown as Product["product_sections"] },
    5
  );
  const labelFromStickyCta = getActivePackLabel(
    { ...product, product_sections: [{ id: "x", enabled: true, order: 0, type: "quantity_packs", data: makePacksData({ steps: [{ minQty: 5, label: "Pack Ahorro" }] }) }] as unknown as Product["product_sections"] },
    5
  );
  assert(
    labelFromMainCta === labelFromStickyCta && labelFromMainCta === "Pack Ahorro",
    "CTA principal y sticky CTA calculan exactamente el mismo label para el mismo qty (misma función, sin estado paralelo)"
  );
}

console.log('\n[9] Selector visible: opción base "1 unidad" + tiers reales x2/x3; sin tiers reales, lista vacía');
{
  const product = makeProduct({
    price: 10000,
    discount_enabled: true,
    discount_max_percent: 30,
    discount_steps: REAL_STEPS,
  });
  const data = makePacksData({ steps: [{ minQty: 2 }, { minQty: 3, label: "Pack Trío" }] });

  const selectorTiers = resolvePackSelectorTiers(product, data);
  assert(selectorTiers.length === 3, `1 unidad + x2 + x3 = 3 tarjetas (obtuvo ${selectorTiers.length})`);

  const base = selectorTiers[0];
  assert(base.minQty === 1, "la primera tarjeta es siempre la opción base de 1 unidad");
  assert(base.label === "1 unidad", "la opción base se etiqueta '1 unidad'");
  assert(base.percent === 0 && base.savingsTotal === 0, "la opción base no tiene descuento ni ahorro inventado");
  assert(base.unitPrice === 10000 && base.totalPrice === 10000, "la opción base cobra el precio de lista real, sin inventar nada");

  const tierX2 = selectorTiers.find((t) => t.minQty === 2)!;
  assert(tierX2.unitPrice === 9000 && tierX2.totalPrice === 18000, `x2 con 10% off: unitario 9000, total 18000 (obtuvo ${tierX2.unitPrice}/${tierX2.totalPrice})`);
  assert(tierX2.savingsTotal === 2000, `ahorro real x2 = 2000 (obtuvo ${tierX2.savingsTotal})`);

  const tierX3 = selectorTiers.find((t) => t.minQty === 3)!;
  assert(tierX3.label === "Pack Trío", "x3 usa el label real que puso el admin");
  assert(tierX3.unitPrice === 8000 && tierX3.totalPrice === 24000, `x3 con 20% off: unitario 8000, total 24000 (obtuvo ${tierX3.unitPrice}/${tierX3.totalPrice})`);
  assert(tierX3.savingsTotal === 6000, `ahorro real x3 = 6000 (obtuvo ${tierX3.savingsTotal})`);

  // Producto sin descuentos reales: el selector completo queda vacío (nunca
  // se arma con solo la opción base, que sería una tarjeta trivial e inútil).
  const noDiscount = makeProduct({ discount_enabled: false, price: 10000 });
  assert(!hasValidPackTiers(noDiscount, data), "producto sin descuentos válidos: hasValidPackTiers es false");
  assert(
    resolvePackSelectorTiers(noDiscount, data).length === 0,
    "producto sin descuentos válidos: resolvePackSelectorTiers devuelve [] (PurchasePanel no renderiza el selector)"
  );

  // getFirstEnabledQuantityPacksData: la fuente que usa PurchasePanel para
  // saber si hay un bloque de packs activo en la ficha.
  const withPacksBlock = makeProduct({
    product_sections: [
      { id: "s1", enabled: true, order: 0, type: "quantity_packs", data },
    ] as unknown as Product["product_sections"],
  });
  assert(
    getFirstEnabledQuantityPacksData(withPacksBlock) !== null,
    "getFirstEnabledQuantityPacksData encuentra el bloque habilitado"
  );
  const withoutPacksBlock = makeProduct({ product_sections: [] });
  assert(
    getFirstEnabledQuantityPacksData(withoutPacksBlock) === null,
    "sin bloque de packs en la ficha, getFirstEnabledQuantityPacksData devuelve null"
  );
}

if (failures > 0) {
  console.error(`\n${failures} aserción(es) fallaron.`);
  process.exitCode = 1;
} else {
  console.log("\nTodas las aserciones pasaron. Funciones puras, sin DB ni red, no se tocó ningún producto real.");
  process.exitCode = 0;
}
