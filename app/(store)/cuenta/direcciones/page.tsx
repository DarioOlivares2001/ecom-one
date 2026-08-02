import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCuentaSessionFromCookies } from "@/lib/cuenta/session";
import { DireccionesClient } from "./DireccionesClient";

export const metadata: Metadata = {
  title: "Mis direcciones",
};

export default function CuentaDireccionesPage() {
  const session = getCuentaSessionFromCookies();
  if (!session) redirect("/cuenta/login");

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col px-4 py-12">
      <h1 className="font-display text-2xl font-bold text-[var(--color-text)] sm:text-3xl">Mis direcciones</h1>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Guarda varias direcciones y marca una como principal. En el checkout podrás autocompletar y editar sin guardar
        automáticamente.
      </p>
      <DireccionesClient />
    </main>
  );
}
