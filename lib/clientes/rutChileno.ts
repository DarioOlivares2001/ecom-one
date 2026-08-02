/** Solo dígitos del cuerpo del RUT (sin puntos ni DV). */
export function rutNumeroSoloDigitos(raw: string): string {
  return String(raw ?? "").replace(/\D/g, "");
}

/** Calcula dígito verificador (0-9 o K) a partir del cuerpo numérico. */
export function calcularDvRutChileno(numeroBody: string): string {
  const body = rutNumeroSoloDigitos(numeroBody).replace(/^0+/, "") || "0";
  let sum = 0;
  let mult = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]!, 10) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const mod = 11 - (sum % 11);
  if (mod === 11) return "0";
  if (mod === 10) return "K";
  return String(mod);
}

function normalizeDv(dv: string): string {
  const d = String(dv ?? "").trim().toUpperCase();
  return d;
}

/**
 * Valida RUT chileno (cuerpo + DV). Acepta cuerpo con o sin puntos.
 * Si `numero` o `dv` están vacíos tras trim → válido (opcional).
 */
export function validateRutChilenoOpcional(numero: string, dv: string): { ok: true } | { ok: false; message: string } {
  const nRaw = String(numero ?? "").trim();
  const dRaw = String(dv ?? "").trim();
  if (!nRaw && !dRaw) return { ok: true };
  if (!nRaw || !dRaw) {
    return { ok: false, message: "Ingresa número y dígito verificador del RUT, o déjalos vacíos." };
  }
  const body = rutNumeroSoloDigitos(nRaw);
  if (body.length < 7 || body.length > 8) {
    return { ok: false, message: "El número del RUT debe tener entre 7 y 8 dígitos." };
  }
  const expected = calcularDvRutChileno(body);
  const got = normalizeDv(dRaw);
  if (got !== expected) {
    return { ok: false, message: "RUT inválido (dígito verificador incorrecto)." };
  }
  return { ok: true };
}

/** Guarda en BD: número sin puntos y DV en mayúsculas. */
export function rutParaGuardar(numero: string, dv: string): { rut_numero: string; rut_dv: string } {
  return {
    rut_numero: rutNumeroSoloDigitos(numero).replace(/^0+/, "") || rutNumeroSoloDigitos(numero),
    rut_dv: normalizeDv(dv),
  };
}
