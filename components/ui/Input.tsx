"use client";

import { forwardRef, useId } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  /** Contenido absoluto sobre el campo (p. ej. toggle); añade padding derecho al input. */
  suffix?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, id, suffix, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const inputClassName = twMerge(
      clsx(
        "h-10 w-full rounded-[var(--radius-sm)] border bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] transition-shadow duration-[var(--transition-fast)]",
        "font-medium placeholder:text-[var(--color-text-secondary)]",
        "outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-0 focus:border-[var(--color-primary)]",
        "disabled:cursor-not-allowed",
        error
          ? "border-[var(--color-error)] focus:ring-[var(--color-error)]"
          : "border-[var(--color-border)]",
        suffix && "pr-11",
        className
      )
    );

    const inputEl = (
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={
          clsx(error && errorId, helperText && !error && helperId) || undefined
        }
        className={inputClassName}
        {...props}
      />
    );

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[var(--color-text)]"
          >
            {label}
          </label>
        )}

        {suffix ? <div className="relative w-full">{inputEl}{suffix}</div> : inputEl}

        {error && (
          <p id={errorId} className="text-xs text-[var(--color-error)]" role="alert">
            {error}
          </p>
        )}

        {helperText && !error && (
          <p id={helperId} className="text-xs text-[var(--color-text-muted)]">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
