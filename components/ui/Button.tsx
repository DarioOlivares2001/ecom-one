"use client";

import { forwardRef } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "[background:var(--brand-gradient)] text-white shadow-[0_8px_24px_rgba(0,0,0,0.16)] hover:brightness-105 active:scale-[0.98] active:brightness-95 disabled:bg-zinc-300 disabled:[background:#d4d4d8] disabled:text-zinc-500 disabled:shadow-none",
  secondary:
    "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-background)] active:scale-[0.98]",
  ghost:
    "bg-transparent text-[var(--color-text)] hover:bg-[var(--color-border)]/30 active:scale-[0.98]",
  danger:
    "bg-[var(--color-error)] text-white hover:bg-[var(--color-error)]/90 active:scale-[0.98]",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

function Spinner({ size }: { size: Size }) {
  const dim = size === "sm" ? "w-3 h-3" : size === "lg" ? "w-5 h-5" : "w-4 h-4";
  return (
    <svg
      className={twMerge("animate-spin shrink-0", dim)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={twMerge(
          clsx(
            "inline-flex items-center justify-center font-medium rounded-[var(--radius-sm)] transition-all duration-[var(--transition-fast)] select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
            "focus-visible:ring-[var(--brand-ring)]",
            "disabled:opacity-50 disabled:pointer-events-none",
            variantClasses[variant],
            sizeClasses[size],
            fullWidth && "w-full",
            className
          )
        )}
        {...props}
      >
        {loading && <Spinner size={size} />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
