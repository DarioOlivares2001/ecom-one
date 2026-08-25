/**
 * Prueba pura (sin DB, sin red, sin tocar productos reales) de la
 * asignación determinista de acentos rotativos para las tarjetas del
 * bloque "Beneficios" (lib: components/store/product-sections/shared/benefitAccents.ts).
 *
 * Uso: npx tsx scripts/verify-benefit-accents.ts
 */
import {
  BENEFIT_ACCENT_COUNT,
  getBenefitAccentIndex,
  getBenefitAccentClassName,
} from "../components/store/product-sections/shared/benefitAccents";

let failures = 0;
function assert(condition: unknown, message: string): void {
  if (condition) {
    console.log(`  OK: ${message}`);
  } else {
    failures += 1;
    console.error(`  FALLO: ${message}`);
  }
}

console.log("[1] Determinista: el mismo índice siempre da el mismo acento");
{
  for (const i of [0, 1, 2, 3, 4, 7, 10, 40]) {
    const a = getBenefitAccentIndex(i);
    const b = getBenefitAccentIndex(i);
    assert(a === b, `índice ${i} -> siempre ${a} (llamado dos veces, mismo resultado)`);
  }
}

console.log("\n[2] Rota entre los 4 acentos, en orden, y se repite cada 4 tarjetas");
{
  const sequence = Array.from({ length: 8 }, (_, i) => getBenefitAccentIndex(i));
  assert(
    JSON.stringify(sequence) === JSON.stringify([0, 1, 2, 3, 0, 1, 2, 3]),
    `secuencia para 8 tarjetas es 0,1,2,3,0,1,2,3 (obtuvo ${sequence.join(",")})`
  );
  assert(BENEFIT_ACCENT_COUNT === 4, `hay exactamente 4 acentos en la paleta (obtuvo ${BENEFIT_ACCENT_COUNT})`);
}

console.log("\n[3] Los 4 índices producen clases distintas entre sí (una por acento, sin repetir)");
{
  const classNames = [0, 1, 2, 3].map((i) => getBenefitAccentClassName(i));
  const unique = new Set(classNames);
  assert(unique.size === 4, `4 índices -> 4 clases distintas (obtuvo ${unique.size}: ${classNames.join(", ")})`);
  for (const cls of classNames) {
    assert(/^bg-\[var\(--benefit-accent-\d\)\]$/.test(cls), `"${cls}" referencia una variable CSS de tema (--benefit-accent-N), no un color hardcodeado`);
  }
}

console.log("\n[4] Nunca lanza con entradas fuera de rango — cae al primer acento en vez de romper");
{
  assert(getBenefitAccentIndex(-1) === 0, "índice negativo -> primer acento (0), no revienta");
  assert(getBenefitAccentIndex(Number.NaN) === 0, "NaN -> primer acento (0)");
  assert(getBenefitAccentIndex(Number.POSITIVE_INFINITY) === 0, "Infinity -> primer acento (0)");
  assert(getBenefitAccentIndex(2.9) === 2, "índice fraccionario se trunca antes de rotar (2.9 -> 2)");
}

console.log(
  "\n[5] La paleta no depende del icono elegido por el admin — dos tarjetas con el mismo icono en distinta posición reciben acentos distintos"
);
{
  // Simula 2 items con icon: "shield" en posiciones 0 y 1: el acento se
  // asigna por posición, nunca por el tipo de icono guardado.
  const accentForPosition0 = getBenefitAccentClassName(0);
  const accentForPosition1 = getBenefitAccentClassName(1);
  assert(
    accentForPosition0 !== accentForPosition1,
    "mismo icono, distinta posición -> distinto acento (la rotación es por índice de tarjeta, no por icono)"
  );
}

if (failures > 0) {
  console.error(`\n${failures} aserción(es) fallaron.`);
  process.exitCode = 1;
} else {
  console.log("\nTodas las aserciones pasaron. Función pura, sin DB ni red, no se tocó ningún dato real.");
  process.exitCode = 0;
}
