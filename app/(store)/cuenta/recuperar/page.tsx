import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCuentaSessionFromCookies } from "@/lib/cuenta/session";
import { RecuperarForm } from "./RecuperarForm";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
};

export default function CuentaRecuperarPage() {
  const session = getCuentaSessionFromCookies();
  if (session) redirect("/cuenta");

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">Olvidé mi contraseña</h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)]">
        Escribe el correo de tu cuenta. Si está registrado, te enviaremos un enlace para elegir una nueva contraseña
        (válido por 1 hora).
      </p>
      <RecuperarForm />
    </main>
  );
}
