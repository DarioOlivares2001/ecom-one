/** Evento global para que el Navbar (y otros clientes) re-sincronicen sesión sin F5. */
export const CLIENTE_SESSION_CHANGED_EVENT = "cliente-session-changed";

export function dispatchClienteSessionChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CLIENTE_SESSION_CHANGED_EVENT));
}
