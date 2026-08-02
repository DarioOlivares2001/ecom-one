import { Truck, ShieldCheck, RotateCcw } from "lucide-react";

const badges = [
  {
    icon: Truck,
    label: "Entrega rápida",
    sub: "Rancagua y alrededores",
  },
  {
    icon: ShieldCheck,
    label: "Pago seguro",
    sub: "con Flow",
  },
  {
    icon: RotateCcw,
    label: "Devolución fácil",
    sub: "Hasta 30 días",
  },
];

export function TrustBadges() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {badges.map(({ icon: Icon, label, sub }) => (
        <div
          key={label}
          className="flex flex-col items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-3 text-center"
        >
          <Icon className="h-5 w-5 text-[var(--color-text-muted)]" strokeWidth={1.5} />
          <span className="text-[11px] font-semibold leading-tight text-[var(--color-text)]">
            {label}
          </span>
          <span className="text-[10px] leading-tight text-[var(--color-text-muted)]">
            {sub}
          </span>
        </div>
      ))}
    </div>
  );
}
