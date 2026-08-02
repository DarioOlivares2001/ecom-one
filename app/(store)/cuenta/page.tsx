import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CuentaLinkButton } from "@/components/cuenta/CuentaLinkButton";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/utils/format";
import { getCuentaSessionFromCookies } from "@/lib/cuenta/session";
import { normalizeClienteEmail } from "@/lib/clientes/upsertClienteFromOrder";
import { recoverClienteFromOrderHistory } from "@/lib/clientes/recoverFromOrderHistory";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";
import { ProfileRecoveryBanner } from "@/components/cuenta/ProfileRecoveryBanner";
import { LogoutButton } from "./LogoutButton";

export const metadata: Metadata = {
  title: "Mi cuenta",
};

export default async function CuentaIndexPage() {
  const session = getCuentaSessionFromCookies();
  if (!session) redirect("/cuenta/login");

  const sessionEmail = normalizeClienteEmail(session.email);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: cliente, error } = await admin
    .from("clientes")
    .select("id,nombre,email,total_orders,total_spent,last_order_at,profile_recovery_ack_at")
    .eq("email", sessionEmail)
    .maybeSingle();

  if (error || !cliente) {
    redirect("/cuenta/login");
  }

  const clienteId = String(cliente.id);
  const recovery = await recoverClienteFromOrderHistory(admin, clienteId, sessionEmail);
  const settings = await getStoreSettings();

  const ackAt = cliente.profile_recovery_ack_at != null ? String(cliente.profile_recovery_ack_at) : "";
  const showRecovery =
    recovery.pastOrdersCount > 0 &&
    !ackAt &&
    recovery.lastSnapshot != null;

  const nombre = String(cliente.nombre ?? "Cliente");
  const email = String(cliente.email ?? sessionEmail);
  const totalOrders = Number(cliente.total_orders ?? 0);
  const totalSpent = Number(cliente.total_spent ?? 0);
  const lastOrderAt = cliente.last_order_at
    ? new Date(String(cliente.last_order_at)).toLocaleString("es-CL", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Sin pedidos";

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col justify-center px-4 py-12">
      {showRecovery ? (
        <ProfileRecoveryBanner storeName={settings.store_name} snapshot={recovery.lastSnapshot!} />
      ) : null}

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm sm:p-8">
        <h1 className="font-display text-2xl font-bold text-[var(--color-text)] sm:text-3xl">Mi cuenta</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]" data-clarity-mask="true">
          Hola, {nombre}.
        </p>
        <p className="text-sm text-[var(--color-text-muted)]" data-clarity-mask="true">
          {email}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] p-3">
            <p className="text-xs text-[var(--color-text-muted)]">Pedidos</p>
            <p className="mt-1 text-xl font-semibold text-[var(--color-text)]">{totalOrders}</p>
          </article>
          <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] p-3">
            <p className="text-xs text-[var(--color-text-muted)]">Total gastado</p>
            <p className="mt-1 text-xl font-semibold text-[var(--color-text)]">{formatPrice(totalSpent)}</p>
          </article>
          <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] p-3">
            <p className="text-xs text-[var(--color-text-muted)]">Último pedido</p>
            <p className="mt-1 text-sm font-medium text-[var(--color-text)]">{lastOrderAt}</p>
          </article>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <a
            href="/cuenta/datos"
            className="relative z-[9999] inline-flex h-12 w-full select-none items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 text-base font-medium text-[var(--color-text)] no-underline pointer-events-auto transition-all duration-[var(--transition-fast)] hover:bg-[var(--color-background)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-[var(--brand-ring)]"
          >
            Editar mis datos
          </a>
          <CuentaLinkButton href="/cuenta/direcciones" variant="secondary">
            Mis direcciones
          </CuentaLinkButton>
          <CuentaLinkButton href="/cuenta/pedidos" variant="secondary">
            Mis pedidos
          </CuentaLinkButton>
          <CuentaLinkButton href="/seguimiento" variant="secondary">
            Seguimiento
          </CuentaLinkButton>
          <CuentaLinkButton href="/productos" variant="primary" className="sm:col-span-2">
            Seguir comprando
          </CuentaLinkButton>
          <div className="w-full sm:col-span-2">
            <LogoutButton />
          </div>
        </div>
      </section>
    </main>
  );
}
