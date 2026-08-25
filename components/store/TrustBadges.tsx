import { Headphones, PackageCheck, ShieldCheck } from "lucide-react";

const badges = [
  {
    icon: ShieldCheck,
    label: "Compra protegida",
    sub: "Pago en línea",
  },
  {
    icon: PackageCheck,
    label: "Información de envío",
    sub: "Detalles en el checkout",
  },
  {
    icon: Headphones,
    label: "Soporte de compra",
    sub: "Antes y después de tu pedido",
  },
];

/**
 * Bloque de confianza bajo el CTA principal. Mobile-first a propósito: las
 * clases base (sin prefijo) son la versión AGRANDADA para mobile; `sm:`
 * revierte exactamente a los valores que ya se veían bien en desktop, sin
 * tocar la apariencia desde ese breakpoint hacia arriba.
 */
export function TrustBadges() {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {badges.map(({ icon: Icon, label, sub }) => (
        <div
          key={label}
          className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-4 text-center sm:gap-1.5 sm:rounded-[var(--radius-md)] sm:px-2 sm:py-3"
        >
          <Icon
            className="h-7 w-7 shrink-0 text-[var(--color-text-muted)] sm:h-5 sm:w-5"
            strokeWidth={1.5}
          />
          <span className="text-[13px] font-semibold leading-tight text-[var(--color-text)] sm:text-[11px]">
            {label}
          </span>
          <span className="text-[11px] leading-tight text-[var(--color-text-muted)] sm:text-[10px]">
            {sub}
          </span>
        </div>
      ))}
    </div>
  );
}
