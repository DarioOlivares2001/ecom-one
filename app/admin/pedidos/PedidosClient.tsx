"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ShoppingBag, ExternalLink } from "lucide-react";
import { formatOrderStatus, normalizeOrderStatusKey } from "@/lib/orders/formatOrderStatus";
import { getOrderPersistedTotal } from "@/lib/orders/orderDisplayTotals";
import { formatPrice } from "@/lib/utils/format";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CLS: Record<string, string> = {
  pending:   "bg-amber-50  text-amber-700",
  paid:      "bg-blue-50   text-blue-700",
  preparing: "bg-violet-50 text-violet-700",
  processing: "bg-violet-50 text-violet-700",
  shipped:   "bg-indigo-50 text-indigo-700",
  delivered: "bg-green-50  text-green-700",
  cancelled: "bg-zinc-100  text-zinc-500",
  failed:    "bg-red-50    text-red-700",
  refunded:  "bg-zinc-100  text-zinc-600",
};

const FILTERS = [
  { key: "all",       label: "Todos" },
  { key: "por-preparar", label: "Por preparar" },
  { key: "pending",   label: "Pedido recibido" },
  { key: "paid",      label: "Pago confirmado" },
  { key: "preparing", label: "Preparando" },
  { key: "shipped",   label: "En despacho" },
  { key: "delivered", label: "Entregados" },
  { key: "cancelled", label: "Cancelados" },
] as const;
type OrderFilter =
  | "all"
  | "pending"
  | "paid"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "por-preparar";

const VALID_FILTERS = new Set<OrderFilter>([
  "all",
  "pending",
  "paid",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
  "por-preparar",
]);
const PAID_NOT_PREPARED_KEYS = new Set(["paid", "pagado", "payment_confirmed"]);
const PREPARED_OR_CLOSED_KEYS = new Set(["preparing", "shipped", "delivered", "cancelled"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function itemsSummary(items: any[]): string {
  if (!Array.isArray(items) || items.length === 0) return "—";
  const parts = items.map(
    (i) => `${i.name ?? "Producto"}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`
  );
  const visible = parts.slice(0, 2).join(", ");
  return parts.length > 2 ? `${visible} +${parts.length - 2} más` : visible;
}

function isPorPrepararStatus(status: string): boolean {
  return PAID_NOT_PREPARED_KEYS.has(status) && !PREPARED_OR_CLOSED_KEYS.has(status);
}

function isOrderFilter(value: string | undefined): value is OrderFilter {
  return !!value && VALID_FILTERS.has(value as OrderFilter);
}

function hoursSince(isoDate: string | null | undefined): number {
  if (!isoDate) return 0;
  const t = new Date(isoDate).getTime();
  if (!Number.isFinite(t)) return 0;
  return (Date.now() - t) / (1000 * 60 * 60);
}

// ─── Component ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PedidosClient({ orders, initialFilter }: { orders: any[]; initialFilter?: string }) {
  const initial: OrderFilter = isOrderFilter(initialFilter) ? initialFilter : "all";
  const [filter, setFilter] = useState<OrderFilter>(initial);
  const [search, setSearch] = useState("");
  const normalizedOrders = useMemo(
    () =>
      orders.map((o) => ({
        ...o,
        status: normalizeOrderStatusKey(o.status) || String(o.status ?? "").trim().toLowerCase(),
      })),
    [orders]
  );

  // Count per status for filter tabs
  const counts = useMemo(() => {
    const map: Record<string, number> = { all: normalizedOrders.length };
    for (const o of normalizedOrders) {
      map[o.status] = (map[o.status] ?? 0) + 1;
      if (isPorPrepararStatus(o.status)) {
        map["por-preparar"] = (map["por-preparar"] ?? 0) + 1;
      }
    }
    return map;
  }, [normalizedOrders]);

  // Filtered + searched list
  const displayed = useMemo(() => {
    let result = normalizedOrders;
    if (filter === "por-preparar") {
      result = result.filter((o) => isPorPrepararStatus(o.status));
    } else if (filter !== "all") {
      result = result.filter((o) => o.status === filter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (o) =>
          String(o.order_number).includes(q) ||
          (o.display_code ?? "").toLowerCase().includes(q) ||
          (o.customer_email ?? "").toLowerCase().includes(q) ||
          (o.customer_name ?? "").toLowerCase().includes(q)
      );
    }
    if (filter === "por-preparar") {
      return [...result].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }
    return result;
  }, [normalizedOrders, filter, search]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-zinc-900">Pedidos</h1>
        <p className="mt-0.5 text-sm text-zinc-500">{orders.length} en total</p>
      </div>

      {/* Filters + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Status tabs */}
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === key
                  ? "bg-zinc-900 text-white"
                  : "bg-white text-zinc-500 ring-1 ring-zinc-200 hover:ring-zinc-400"
              }`}
            >
              {label}
              {counts[key] != null && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                    filter === key ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {counts[key] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por SO..., email o nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <ShoppingBag className="h-10 w-10 text-zinc-200" strokeWidth={1} />
            <p className="text-sm text-zinc-400">
              {orders.length === 0
                ? "Aún no hay pedidos registrados."
                : "No hay pedidos que coincidan con el filtro."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  <th className="px-5 py-3">#</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Productos</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {displayed.map((order: any) => (
                  <tr key={order.id} className="transition-colors hover:bg-zinc-50">
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs font-semibold text-zinc-500">
                        {order.display_code ?? `#${order.order_number}`}
                      </span>
                    </td>

                    <td className="px-5 py-3">
                      <p className="font-medium text-zinc-900">{order.customer_name}</p>
                      <p className="text-xs text-zinc-400">{order.customer_email}</p>
                    </td>

                    <td className="max-w-[200px] px-5 py-3">
                      <p className="truncate text-xs text-zinc-600">
                        {itemsSummary(order.items ?? [])}
                      </p>
                    </td>

                    <td className="px-5 py-3 font-semibold text-zinc-900">
                      {formatPrice(getOrderPersistedTotal(order))}
                    </td>

                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            STATUS_CLS[order.status] ?? "bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          {formatOrderStatus(order.status)}
                        </span>
                        {isPorPrepararStatus(order.status) ? (
                          <>
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                              Por preparar
                            </span>
                            {hoursSince(order.created_at) > 48 ? (
                              <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                                Atrasado
                              </span>
                            ) : hoursSince(order.created_at) > 24 ? (
                              <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                                Urgente
                              </span>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-5 py-3 text-xs text-zinc-400">
                      {new Date(order.created_at).toLocaleDateString("es-CL", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/admin/pedidos/${order.id}`}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
