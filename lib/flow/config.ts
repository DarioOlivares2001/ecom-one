/**
 * Configuración compartida de Flow Chile, usada por
 * `app/api/flow/create`, `app/api/flow/webhook` y
 * `app/api/orders/cancel-if-unpaid`.
 *
 * No cambia el flujo de pago existente (firma HMAC, creación de orden, modo
 * mock, manejo del webhook) — solo centraliza estas tres constantes, que
 * antes estaban duplicadas idénticas en los tres archivos, con exactamente
 * la misma resolución que ya tenían: `FLOW_API_URL` explícita si existe,
 * si no, sandbox por defecto.
 *
 * `FLOW_ENV` es nueva: declara la intención ("sandbox" por defecto, o
 * "production") y nunca cambia qué URL se usa — solo dispara una advertencia
 * en consola si la combinación de variables no tiene sentido (p. ej. decir
 * `FLOW_ENV=sandbox` pero tener `FLOW_API_URL` apuntando a otro host, o
 * declarar `FLOW_ENV=production` corriendo fuera de un build de producción
 * real como `npm run dev`). Sirve para detectar un error de configuración
 * temprano, no para decidir el comportamiento.
 */

export const FLOW_SANDBOX_API_URL = "https://sandbox.flow.cl/api";

export const FLOW_API_URL = process.env.FLOW_API_URL ?? FLOW_SANDBOX_API_URL;
export const FLOW_API_KEY = process.env.FLOW_API_KEY ?? "";
export const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY ?? "";

type FlowEnv = "sandbox" | "production";

function resolveFlowEnv(): FlowEnv {
  const raw = (process.env.FLOW_ENV ?? "sandbox").trim().toLowerCase();
  if (raw === "production") return "production";
  if (raw !== "sandbox") {
    warnOnce(
      `FLOW_ENV="${raw}" no es un valor válido (usa "sandbox" o "production"); se trata como "sandbox".`
    );
  }
  return "sandbox";
}

let warnedMessage: string | null = null;
function warnOnce(message: string) {
  if (warnedMessage === message) return;
  warnedMessage = message;
  console.warn(`[flow-config] ${message}`);
}

const flowEnv = resolveFlowEnv();

if (flowEnv === "sandbox" && !FLOW_API_URL.includes("sandbox.flow.cl")) {
  warnOnce(
    `FLOW_ENV=sandbox (o sin definir) pero FLOW_API_URL apunta a "${FLOW_API_URL}", que no es sandbox.flow.cl. ` +
      "Revisa .env.local: las llamadas a Flow no están yendo a sandbox."
  );
} else if (flowEnv === "production" && process.env.NODE_ENV !== "production") {
  warnOnce(
    "FLOW_ENV=production pero NODE_ENV no es 'production' (¿estás corriendo `npm run dev`?). " +
      "Confirma que sea intencional: si no, las credenciales de Flow podrían apuntar a producción fuera de un deploy real."
  );
}
