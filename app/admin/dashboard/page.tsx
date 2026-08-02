import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { TrendingUp, ShoppingBag, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { getDashboardMetrics } from "@/lib/db/repositories/orders";
import { normalizeOrderStatusKey } from "@/lib/orders/formatOrderStatus";
import { getOrderPersistedTotal } from "@/lib/orders/orderDisplayTotals";
import { formatPrice } from "@/lib/utils/format";
import type { ChartDay } from "./SalesChart";

export const metadata: Metadata = { title: "Dashboard — Admin" };

// Chart is client-only (recharts uses browser APIs)
const SalesChart = dynamic(
  () => import("./SalesChart").then((m) => m.SalesChart),
  { ssr: false, loading: () => <div className="h-[220px] animate-pulse rounded-lg bg-zinc-100" /> }
);

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pending:   "Pendiente",
  paid:      "Pagado",
  shipped:   "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

const STATUS_CLS: Record<string, string> = {
  pending:   "bg-amber-50  text-amber-700",
  paid:      "bg-blue-50   text-blue-700",
  shipped:   "bg-indigo-50 text-indigo-700",
  delivered: "bg-green-50  text-green-700",
  cancelled: "bg-zinc-100  text-zinc-500",
};

// ─── Data fetching ────────────────────────────────────────────────────────────

const PAID_NOT_PREPARED_KEYS = new Set(["paid", "pagado", "payment_confirmed"]);
const PREPARED_OR_CLOSED_KEYS = new Set(["preparing", "shipped", "delivered", "cancelled"]);

async function getDashboardData() {
  try {
    const now   = new Date();
    const y     = now.getFullYear();
    const m     = now.getMonth();
    const d     = now.getDate();

    const todayStart  = new Date(y, m, d);
    const monthStart  = new Date(y, m, 1);
    const weekStart   = new Date(y, m, d - 6);

    const { todayRows, monthRows, pendingCount, completedCount, recentOrders, chartRows, allStatuses } =
      await getDashboardMetrics({ todayStart, monthStart, weekStart });

    // ── Metrics ──
    type OrderTotalRow = { total: number | string | null };
    const sum = (rows: OrderTotalRow[]) =>
      rows.reduce(
        (acc: number, r: OrderTotalRow) =>
          acc + getOrderPersistedTotal(r as unknown as Record<string, unknown>),
        0
      );
    const todaySales  = sum(todayRows);
    const monthSales  = sum(monthRows);
    const pending     = pendingCount;
    const completed   = completedCount;
    const porPreparar = allStatuses.filter((status) => {
      const key = normalizeOrderStatusKey(status);
      return PAID_NOT_PREPARED_KEYS.has(key) && !PREPARED_OR_CLOSED_KEYS.has(key);
    }).length;

    // ── Chart: fill all 7 days including zeros ──
    const chartData: ChartDay[] = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(y, m, d - (6 - i));
      return {
        date:    day.toLocaleDateString("es-CL", { weekday: "short", day: "numeric" }),
        dateKey: day.toISOString().slice(0, 10),
        total:   0,
      };
    });

    for (const order of chartRows) {
      const key = new Date(order.created_at).toISOString().slice(0, 10);
      const slot = chartData.find((c) => c.dateKey === key);
      if (slot) slot.total += getOrderPersistedTotal(order as Record<string, unknown>);
    }

    return {
      todaySales,
      monthSales,
      pending,
      porPreparar,
      completed,
      recentOrders,
      chartData,
    };
  } catch {
    const now = new Date();
    return {
      todaySales:   0,
      monthSales:   0,
      pending:      0,
      porPreparar:  0,
      completed:    0,
      recentOrders: [],
      chartData: Array.from({ length: 7 }, (_, i) => {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
        return {
          date:    day.toLocaleDateString("es-CL", { weekday: "short", day: "numeric" }),
          dateKey: day.toISOString().slice(0, 10),
          total:   0,
        };
      }),
    };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  title,
  value,
  sub,
  icon,
  iconCls,
}: {
  title: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  iconCls: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</p>
          <p className="mt-2 truncate text-2xl font-bold text-zinc-900">{value}</p>
          <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconCls}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_CLS[status] ?? "bg-zinc-100 text-zinc-500"
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { todaySales, monthSales, pending, porPreparar, completed, recentOrders, chartData } =
    await getDashboardData();

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          {new Date().toLocaleDateString("es-CL", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          title="Ventas hoy"
          value={formatPrice(todaySales)}
          sub="pedidos pagados hoy"
          icon={<TrendingUp className="h-5 w-5 text-green-600" />}
          iconCls="bg-green-50"
        />
        <MetricCard
          title="Ventas del mes"
          value={formatPrice(monthSales)}
          sub="mes en curso"
          icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
          iconCls="bg-blue-50"
        />
        <MetricCard
          title="Pedidos pendientes"
          value={String(pending)}
          sub="esperando pago"
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          iconCls="bg-amber-50"
        />
        <MetricCard
          title="Completados mes"
          value={String(completed)}
          sub="pagados / enviados / entregados"
          icon={<CheckCircle2 className="h-5 w-5 text-indigo-600" />}
          iconCls="bg-indigo-50"
        />
      </div>

      <div
        className={`rounded-xl border p-4 shadow-sm ${
          porPreparar > 0 ? "border-amber-300 bg-amber-50/60" : "border-zinc-200 bg-white"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg ${
                porPreparar > 0 ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-500"
              }`}
            >
              <AlertCircle className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-900">Por preparar</p>
              <p className="text-sm text-zinc-600">
                {porPreparar} pedidos pagados requieren preparación
              </p>
            </div>
          </div>
          <Link
            href="/admin/pedidos?filter=por-preparar"
            className={`inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium ${
              porPreparar > 0
                ? "bg-amber-600 text-white hover:bg-amber-700"
                : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Ver pedidos
          </Link>
        </div>
      </div>

      {/* ── Sales chart ── */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-900">Ventas últimos 7 días</h2>
          <p className="text-xs text-zinc-400">Monto total en CLP de pedidos pagados</p>
        </div>
        <div className="p-4">
          <SalesChart data={chartData} />
        </div>
      </div>

      {/* ── Recent orders table ── */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-900">Últimos pedidos</h2>
        </div>

        {recentOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <ShoppingBag className="h-10 w-10 text-zinc-200" strokeWidth={1} />
            <p className="text-sm text-zinc-400">Aún no hay pedidos registrados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  <th className="px-5 py-3">#</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {recentOrders.map((order: any) => (
                  <tr key={order.order_number} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-zinc-500">
                      {order.display_code ?? `#${order.order_number}`}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-zinc-900">{order.customer_name}</p>
                      <p className="text-xs text-zinc-400">{order.customer_email}</p>
                    </td>
                    <td className="px-5 py-3 font-semibold text-zinc-900">
                      {formatPrice(getOrderPersistedTotal(order as Record<string, unknown>))}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-400">
                      {new Date(order.created_at).toLocaleDateString("es-CL", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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
