import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";
import { Button } from "@/components/ui/Button";
import { getCuentaSessionFromCookies } from "@/lib/cuenta/session";
import { getSafePostLoginRedirect } from "@/lib/cuenta/safeRedirect";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

export default async function CuentaLoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string | string[] };
}) {
  const session = getCuentaSessionFromCookies();
  if (session) redirect(getSafePostLoginRedirect(searchParams.redirect, "/"));

  const settings = await getStoreSettings();

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">Iniciar sesión</h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)]">
        Entra con tu correo y contraseña para ver tus pedidos, datos guardados y beneficios en {settings.store_name}.
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
        <LoginForm />
      </Suspense>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/productos" className="w-full sm:w-auto">
          <Button variant="primary" size="lg" fullWidth className="sm:min-w-[180px]">
            Seguir comprando
          </Button>
        </Link>
      </div>
    </main>
  );
}
