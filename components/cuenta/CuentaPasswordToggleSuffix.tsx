"use client";

import { Eye, EyeOff } from "lucide-react";

const BTN_CLASS =
  "absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-0";

export type CuentaPasswordToggleSuffixProps = {
  visible: boolean;
  onToggle: () => void;
};

/**
 * Botón estándar (ojo) para mostrar/ocultar contraseña en formularios de cuenta.
 * Mismo aspecto y aria en todos los usos.
 */
export function CuentaPasswordToggleSuffix({ visible, onToggle }: CuentaPasswordToggleSuffixProps) {
  return (
    <button
      type="button"
      aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      className={BTN_CLASS}
      onClick={onToggle}
    >
      {visible ? (
        <EyeOff className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2} aria-hidden />
      ) : (
        <Eye className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2} aria-hidden />
      )}
    </button>
  );
}
