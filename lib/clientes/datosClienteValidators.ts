import { rutNumeroSoloDigitos, validateRutChilenoOpcional } from "@/lib/clientes/rutChileno";

/** Nombre de perfil: mínimo 2 caracteres no vacíos. */
export function validateNombreCliente(raw: string): string | undefined {
  const s = String(raw ?? "").trim();
  if (s.length < 2) return "Ingresa al menos 2 caracteres.";
  return undefined;
}

/**
 * Celular chileño básico: normaliza quitando espacios y no-dígitos excepto lógica +56.
 * Válido si queda 9 dígitos empezando en 9 (ej. +56 9 3572 2190 → 935722190).
 */
export function validateTelefonoChileno(raw: string): string | undefined {
  const t = String(raw ?? "").trim();
  if (!t) return "El teléfono es obligatorio.";
  let d = t.replace(/\D/g, "");
  if (d.startsWith("56")) d = d.slice(2);
  while (d.startsWith("0")) d = d.slice(1);
  if (d.length !== 9 || !/^9\d{8}$/.test(d)) {
    return "Teléfono no válido. Ejemplo: +56 9 3572 2190";
  }
  return undefined;
}

export type RutCamposErrores = { rut_numero?: string; rut_dv?: string };

/** RUT opcional; si hay parte de uno, exige el otro y valida módulo 11. */
export function validateRutCampos(numeroRaw: string, dvRaw: string): RutCamposErrores {
  const n = String(numeroRaw ?? "").trim();
  const d = String(dvRaw ?? "").trim().toUpperCase();
  if (!n && !d) return {};

  if (!n) return { rut_numero: "Ingresa el número del RUT o borra el DV." };
  if (!d) return { rut_dv: "Ingresa el dígito verificador o borra el número." };

  if (!/^[\d.\s]+$/.test(n)) {
    return { rut_numero: "El cuerpo del RUT solo debe contener números." };
  }

  const body = rutNumeroSoloDigitos(n);
  if (body.length < 7 || body.length > 8) {
    return { rut_numero: "El número del RUT debe tener entre 7 y 8 dígitos." };
  }

  if (d.length !== 1 || !/^[0-9K]$/.test(d)) {
    return { rut_dv: "El DV debe ser un dígito (0-9) o la letra K." };
  }

  const r = validateRutChilenoOpcional(n, d);
  if (!r.ok) return { rut_dv: r.message };
  return {};
}
