import { ZodError } from "zod";

import type { ProductSectionList } from "./types";
import { reindexSections } from "./defaults";
import { productSectionsSchema } from "./types";

export type ParseProductSectionsResult =
  | { ok: true; data: ProductSectionList }
  | { ok: false; error: string };

/**
 * Lee y valida `product_sections_json` de un FormData enviado por el admin.
 * - Si no viene el campo: trata como `[]` (vacío) → safe no-op.
 * - Si viene JSON inválido o no pasa el schema: devuelve error con mensaje.
 * - Si pasa: reindexa el `order` por posición y devuelve la lista.
 */
export function parseProductSectionsFromFormData(
  formData: FormData,
): ParseProductSectionsResult {
  const raw = formData.get("product_sections_json");

  if (raw == null || (typeof raw === "string" && raw.trim() === "")) {
    return { ok: true, data: [] };
  }

  if (typeof raw !== "string") {
    return { ok: false, error: "product_sections_json debe ser un string JSON." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "product_sections_json no es un JSON válido." };
  }

  try {
    const valid = productSectionsSchema.parse(parsed);
    return { ok: true, data: reindexSections(valid) };
  } catch (err) {
    if (err instanceof ZodError) {
      const first = err.errors[0];
      const path = first?.path?.join(".") ?? "";
      const msg = first?.message ?? "validación falló";
      return {
        ok: false,
        error: `Bloque modular inválido${path ? ` (${path})` : ""}: ${msg}`,
      };
    }
    return { ok: false, error: "Error desconocido validando bloques modulares." };
  }
}
