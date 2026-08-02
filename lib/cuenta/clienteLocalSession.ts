/** Sesión local de cliente (hasta exista login real con servidor). */
const STORAGE_KEY = "tg_cliente_session_v1";

export function isClienteLocalSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setClienteLocalSession(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
    window.dispatchEvent(new Event("tg-cliente-session"));
  } catch {
    // ignore
  }
}

export function clearClienteLocalSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("tg-cliente-session"));
  } catch {
    // ignore
  }
}
