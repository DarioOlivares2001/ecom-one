import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCuentaSessionFromCookies } from "@/lib/cuenta/session";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Nueva contraseña",
};

export default function CuentaResetPage() {
  const session = getCuentaSessionFromCookies();
  if (session) redirect("/cuenta");

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">Nueva contraseña</h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)]">
        Elige una contraseña segura. El enlace del correo caduca en 1 hora.
      </p>
      <Suspense
        fallback={
          <div className="mt-8 space-y-4" aria-hidden>
            <div className="h-14 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-border)]/35" />
            <div className="h-14 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-border)]/35" />
            <div className="h-12 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-border)]/35" />
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
      <p className="mt-8 text-center text-sm text-[var(--color-text-muted)]">
        <Link href="/cuenta/recuperar" className="font-medium text-[var(--color-primary)] underline underline-offset-2">
          Solicitar otro enlace
        </Link>
      </p>
    </main>
  );
}
