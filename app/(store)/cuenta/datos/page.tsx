import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeClienteEmail } from "@/lib/clientes/upsertClienteFromOrder";
import { getCuentaSessionFromCookies } from "@/lib/cuenta/session";
import { DatosForm, type DatosIniciales } from "./DatosForm";

export const metadata: Metadata = {
  title: "Mis datos",
};

export default async function CuentaDatosPage() {
  const session = getCuentaSessionFromCookies();
  if (!session) redirect("/cuenta/login");

  const email = normalizeClienteEmail(session.email);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: cliente, error } = await admin
    .from("clientes")
    .select("nombre,email,telefono,rut_numero,rut_dv")
    .eq("email", email)
    .maybeSingle();

  if (error || !cliente) {
    redirect("/cuenta/login");
  }

  const initial: DatosIniciales = {
    nombre: String(cliente.nombre ?? ""),
    email: String(cliente.email ?? email),
    telefono: cliente.telefono != null ? String(cliente.telefono) : "",
    rut_numero: cliente.rut_numero != null ? String(cliente.rut_numero) : "",
    rut_dv: cliente.rut_dv != null ? String(cliente.rut_dv) : "",
  };

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col px-4 py-12">
      <h1 className="font-display text-2xl font-bold text-[var(--color-text)] sm:text-3xl">Mis datos</h1>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Actualiza tu nombre, teléfono y RUT. Estos datos se usan en tus pedidos y comunicaciones.
      </p>
      <DatosForm initial={initial} />
    </main>
  );
}
