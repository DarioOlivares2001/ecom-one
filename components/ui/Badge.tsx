import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "outline";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:
    "bg-[var(--color-border)] text-[var(--color-text)]",
  success:
    "bg-[var(--color-success)]/10 text-[var(--color-success)]",
  warning:
    "bg-amber-100 text-amber-700",
  danger:
    "bg-[var(--color-error)]/10 text-[var(--color-error)]",
  outline:
    "border border-[var(--color-border)] text-[var(--color-text-muted)] bg-transparent",
};

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={twMerge(
        clsx(
          "inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-0.5 text-xs font-medium",
          variantClasses[variant],
          className
        )
      )}
    >
      {children}
    </span>
  );
}
