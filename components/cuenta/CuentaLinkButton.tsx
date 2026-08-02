import Link from "next/link";
import { twMerge } from "tailwind-merge";

const base =
  "inline-flex h-12 items-center justify-center rounded-[var(--radius-sm)] px-6 text-base font-medium transition-all duration-[var(--transition-fast)] select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-[var(--brand-ring)]";

const secondary =
  "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-background)] active:scale-[0.98]";

const primary =
  "[background:var(--brand-gradient)] text-white shadow-[0_8px_24px_rgba(0,0,0,0.16)] hover:brightness-105 active:scale-[0.98] active:brightness-95";

type Props = {
  href: string;
  variant?: "primary" | "secondary";
  /** Por defecto ancho completo (grid en /cuenta). */
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
};

/** Enlace con apariencia de Button (evita anidar `button` dentro de `a`). */
export function CuentaLinkButton({
  href,
  variant = "secondary",
  fullWidth = true,
  className,
  children,
}: Props) {
  return (
    <Link
      href={href}
      className={twMerge(
        base,
        variant === "primary" ? primary : secondary,
        fullWidth && "w-full",
        className
      )}
    >
      {children}
    </Link>
  );
}
