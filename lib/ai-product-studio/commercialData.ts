import { z } from "zod";

import { validateDropiProductUrl } from "@/lib/products/dropiLink";

/**
 * Datos comerciales del Estudio IA de Producto (precio, precio comparativo,
 * stock, costo, enlace Dropi). Deliberadamente separado de `AIProductDraft`
 * (schema.ts): ese tipo es solo lo que el modelo puede llegar a generar —
 * esto es exclusivamente responsabilidad humana, la IA nunca los inventa ni
 * los modifica. El admin los completa en el Paso 3 antes de "Aplicar al
 * borrador"; de ahí viajan por el mismo puente de sessionStorage
 * (`bridge.ts`) hasta el formulario manual de `/admin/productos/nuevo`.
 */
export const commercialDataSchema = z.object({
  price: z.number().int().positive(),
  compareAtPrice: z.number().int().positive().nullable(),
  stock: z.number().int().nonnegative(),
  costPrice: z.number().int().positive().nullable(),
  dropiProductUrl: z.string().url().nullable(),
});
export type CommercialData = z.infer<typeof commercialDataSchema>;

/** Estado crudo del formulario "Datos comerciales" (siempre strings, como cualquier input controlado). */
export interface CommercialFormInput {
  price: string;
  compareAtPrice: string;
  stock: string;
  costPrice: string;
  dropiProductUrl: string;
}

export type CommercialField =
  | "price"
  | "compareAtPrice"
  | "stock"
  | "costPrice"
  | "dropiProductUrl";

export interface CommercialValidationError {
  field: CommercialField;
  message: string;
}

export type CommercialValidationResult =
  | { ok: true; data: CommercialData }
  | { ok: false; errors: CommercialValidationError[] };

/** Solo dígitos (ya recortado) — rechaza negativos, decimales y texto. */
const POSITIVE_INTEGER_PATTERN = /^\d+$/;

/**
 * Valida el formulario de datos comerciales del asistente. Pura — sin red,
 * sin acceso a Neon/R2, sin generar ningún valor: solo interpreta lo que el
 * admin escribió.
 */
export function validateCommercialData(
  input: CommercialFormInput
): CommercialValidationResult {
  const errors: CommercialValidationError[] = [];

  // ── Precio de venta: obligatorio, entero positivo ──
  let price: number | null = null;
  const priceTrim = input.price.trim();
  if (!priceTrim) {
    errors.push({ field: "price", message: "El precio de venta es obligatorio." });
  } else if (!POSITIVE_INTEGER_PATTERN.test(priceTrim) || Number(priceTrim) <= 0) {
    errors.push({
      field: "price",
      message: "El precio de venta debe ser un número entero positivo, sin decimales.",
    });
  } else {
    price = Number(priceTrim);
  }

  // ── Precio comparativo: opcional, entero positivo, > precio de venta ──
  let compareAtPrice: number | null = null;
  const compareTrim = input.compareAtPrice.trim();
  if (compareTrim) {
    if (!POSITIVE_INTEGER_PATTERN.test(compareTrim) || Number(compareTrim) <= 0) {
      errors.push({
        field: "compareAtPrice",
        message: "El precio comparativo debe ser un número entero positivo.",
      });
    } else {
      compareAtPrice = Number(compareTrim);
      if (price !== null && compareAtPrice <= price) {
        errors.push({
          field: "compareAtPrice",
          message: "El precio comparativo debe ser mayor que el precio de venta.",
        });
      }
    }
  }

  // ── Stock: obligatorio, entero >= 0 ──
  let stock: number | null = null;
  const stockTrim = input.stock.trim();
  if (!stockTrim) {
    errors.push({ field: "stock", message: "El stock es obligatorio." });
  } else if (!POSITIVE_INTEGER_PATTERN.test(stockTrim)) {
    errors.push({
      field: "stock",
      message: "El stock debe ser un número entero mayor o igual a cero.",
    });
  } else {
    stock = Number(stockTrim);
  }

  // ── Precio costo: opcional, entero positivo, nunca sale al storefront ──
  let costPrice: number | null = null;
  const costTrim = input.costPrice.trim();
  if (costTrim) {
    if (!POSITIVE_INTEGER_PATTERN.test(costTrim) || Number(costTrim) <= 0) {
      errors.push({
        field: "costPrice",
        message: "El precio costo debe ser un número entero positivo.",
      });
    } else {
      costPrice = Number(costTrim);
    }
  }

  // ── URL de Dropi: misma validación exacta que el formulario manual ──
  let dropiProductUrl: string | null = null;
  const dropiResult = validateDropiProductUrl(input.dropiProductUrl);
  if (!dropiResult.ok) {
    errors.push({ field: "dropiProductUrl", message: dropiResult.error });
  } else {
    dropiProductUrl = dropiResult.url;
  }

  if (errors.length > 0 || price === null || stock === null) {
    return { ok: false, errors };
  }

  return { ok: true, data: { price, compareAtPrice, stock, costPrice, dropiProductUrl } };
}

/** Los mismos nombres de campo que espera el `form` de `/admin/productos/nuevo` (todos strings, inputs controlados). */
export interface NuevoProductCommercialPatch {
  price: string;
  compare_at_price: string;
  cost_price: string;
  stock: string;
  dropi_product_url: string;
}

/** Mapea datos comerciales ya validados al payload que consume el formulario manual. */
export function commercialDataToFormPatch(data: CommercialData): NuevoProductCommercialPatch {
  return {
    price: String(data.price),
    compare_at_price: data.compareAtPrice !== null ? String(data.compareAtPrice) : "",
    cost_price: data.costPrice !== null ? String(data.costPrice) : "",
    stock: String(data.stock),
    dropi_product_url: data.dropiProductUrl ?? "",
  };
}
