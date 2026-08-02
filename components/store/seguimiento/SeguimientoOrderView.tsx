import Link from "next/link";
import { Package } from "lucide-react";
import type { PublicOrderTracking } from "@/lib/orders/getPublicOrderByNumber";
import { formatOrderStatus, normalizeOrderStatusKey } from "@/lib/orders/formatOrderStatus";
import { formatPrice } from "@/lib/utils/format";
import { SeguimientoTimeline } from "./SeguimientoTimeline";

function statusBadgeClass(status: string): string {
  const s = normalizeOrderStatusKey(status);
  const map: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-800 border-amber-400/40",
    paid: "bg-sky-500/15 text-sky-900 border-sky-400/40",
    processing: "bg-violet-500/15 text-violet-900 border-violet-400/40",
    preparing: "bg-violet-500/15 text-violet-900 border-violet-400/40",
    shipped: "bg-indigo-500/15 text-indigo-900 border-indigo-400/40",
    delivered: "bg-emerald-500/15 text-emerald-900 border-emerald-400/40",
    cancelled: "bg-[var(--color-border)] text-[var(--color-text-muted)] border-[var(--color-border)]",
    failed: "bg-red-500/12 text-red-900 border-red-400/35",
    refunded: "bg-zinc-400/15 text-zinc-800 border-zinc-400/35",
  };
  return map[s] ?? "bg-[var(--color-border)] text-[var(--color-text)] border-[var(--color-border)]";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseItems(items: unknown): any[] {
  if (!Array.isArray(items)) return [];
  return items;
}

export function SeguimientoOrderView({ order }: { order: PublicOrderTracking }) {
  const items = parseItems(order.items);
  const created = new Date(order.created_at).toLocaleString("es-CL", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const statusLabel = formatOrderStatus(order.status);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Pedido
          </p>
          <h1 className="font-display text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
            {order.display_code ?? `#${order.order_number}`}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{created}</p>
        </div>
        <span
          className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(order.status)}`}
        >
          {statusLabel}
        </span>
      </div>

      <SeguimientoTimeline status={order.status} />

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 lg:col-span-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
            Cliente
          </h2>
          <dl className="mt-4 space-y-3 text-sm" data-clarity-mask="true">
            <div>
              <dt className="text-xs text-[var(--color-text-muted)]">Nombre</dt>
              <dd className="mt-0.5 font-medium text-[var(--color-text)]">{order.customer_name}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-text-muted)]">Email</dt>
              <dd className="mt-0.5 break-all font-medium text-[var(--color-text)]">{order.customer_email}</dd>
            </div>
            {order.customer_phone ? (
              <div>
                <dt className="text-xs text-[var(--color-text-muted)]">Teléfono</dt>
                <dd className="mt-0.5 font-medium text-[var(--color-text)]">{order.customer_phone}</dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-6 border-t border-[var(--color-border)] pt-4">
            <p className="text-xs text-[var(--color-text-muted)]">Total</p>
            <p className="mt-1 font-display text-2xl font-bold text-[var(--color-text)]">
              {formatPrice(Number(order.total ?? 0))}
            </p>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              Subtotal {formatPrice(Number(order.subtotal ?? 0))} + envío{" "}
              {formatPrice(Number(order.shipping_cost ?? 0))}
            </p>
          </div>
        </section>

        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 lg:col-span-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
            Productos
          </h2>
          {items.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--color-text-muted)]">No hay detalle de productos en este pedido.</p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--color-border)]/80">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {items.map((item: any, i: number) => {
                const qty = Number(item.quantity ?? 1);
                const price = Number(item.price ?? 0);
                const line = price * qty;
                return (
                  <li key={i} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)]">
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image}
                          alt={item.name ? String(item.name) : "Producto"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[var(--color-text-muted)]">
                          <Package className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[var(--color-text)]">{item.name ?? "Producto"}</p>
                      {item.variant ? (
                        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{String(item.variant)}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        {formatPrice(price)} × {qty}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-[var(--color-text)]">{formatPrice(line)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <p className="text-center text-sm text-[var(--color-text-muted)]">
        <Link href="/seguimiento" className="font-medium text-[var(--color-primary)] underline underline-offset-2">
          Buscar otro pedido
        </Link>
        {" · "}
        <Link href="/productos" className="font-medium text-[var(--color-primary)] underline underline-offset-2">
          Seguir comprando
        </Link>
      </p>
    </div>
  );
}
