import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatOrderStatus } from "@/lib/orders/formatOrderStatus";
import { formatPrice } from "@/lib/utils/format";
import { getCuentaSessionFromCookies } from "@/lib/cuenta/session";

export const metadata: Metadata = {
  title: "Mis pedidos",
};

type CuentaPedido = {
  id: string;
  order_number: number;
  display_code: string | null;
  created_at: string;
  total: number;
  status: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function CuentaPedidosPage() {
  const session = getCuentaSessionFromCookies();
  if (!session) redirect("/cuenta/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data, error } = await admin
    .from("orders")
    .select("id,order_number,display_code,created_at,total,status")
    .ilike("customer_email", session.email)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[cuenta-pedidos] error", error.message);
  }

  const pedidos: CuentaPedido[] = Array.isArray(data) ? data : [];

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-4xl flex-col px-4 py-12">
      <h1 className="font-display text-2xl font-bold text-[var(--color-text)] sm:text-3xl">Mis pedidos</h1>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]" data-clarity-mask="true">
        Pedidos asociados a {session.email}
      </p>

      <section className="mt-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--color-border)] text-sm">
            <thead className="bg-[var(--color-background)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-[var(--color-text)]">Pedido</th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--color-text)]">Fecha</th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--color-text)]">Total</th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--color-text)]">Estado</th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--color-text)]">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {pedidos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                    Aún no tienes pedidos registrados.
                  </td>
                </tr>
              ) : (
                pedidos.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono font-medium text-[var(--color-text)]">{p.display_code ?? `#${p.order_number}`}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-muted)]">{formatDate(p.created_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-[var(--color-text)]">
                      {formatPrice(p.total)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-muted)]">
                      {formatOrderStatus(p.status)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/seguimiento?order=${encodeURIComponent(p.display_code ?? String(p.order_number))}`}
                        className="text-sm font-medium text-[var(--color-primary)] hover:opacity-80"
                      >
                        Ver seguimiento
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/cuenta" className="w-full sm:w-auto">
          <Button variant="secondary" size="lg" fullWidth>
            Volver a Mi cuenta
          </Button>
        </Link>
        <Link href="/productos" className="w-full sm:w-auto">
          <Button variant="primary" size="lg" fullWidth>
            Seguir comprando
          </Button>
        </Link>
      </div>
    </main>
  );
}
