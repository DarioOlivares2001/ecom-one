"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Package, ChevronDown, Workflow, MessageCircle } from "lucide-react";
import { formatOrderStatus, normalizeOrderStatusKey } from "@/lib/orders/formatOrderStatus";
import {
  getOrderPersistedTotals,
  getPersistedLineAmount,
} from "@/lib/orders/orderDisplayTotals";
import { formatPrice } from "@/lib/utils/format";
import { toast } from "@/components/ui/Toast";
import { OrderTimeline } from "@/components/admin/OrderTimeline";
import { updateOrderStatusAction } from "../actions";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pedido recibido" },
  { value: "paid", label: "Pago confirmado" },
  { value: "preparing", label: "Preparando" },
  { value: "shipped", label: "En despacho" },
  { value: "delivered", label: "Entregado" },
  { value: "cancelled", label: "Cancelado" },
] as const;

const STATUS_CLS: Record<string, string> = {
  pending: "bg-amber-50  text-amber-700  border-amber-200",
  paid: "bg-blue-50   text-blue-700   border-blue-200",
  preparing: "bg-violet-50 text-violet-700 border-violet-200",
  processing: "bg-violet-50 text-violet-700 border-violet-200",
  shipped: "bg-indigo-50 text-indigo-700 border-indigo-200",
  delivered: "bg-green-50  text-green-700  border-green-200",
  cancelled: "bg-zinc-100  text-zinc-500   border-zinc-200",
  failed: "bg-red-50    text-red-700    border-red-200",
  refunded: "bg-zinc-100  text-zinc-600   border-zinc-200",
};

const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-400",
  paid: "bg-blue-400",
  preparing: "bg-violet-400",
  processing: "bg-violet-400",
  shipped: "bg-indigo-400",
  delivered: "bg-green-400",
  cancelled: "bg-zinc-400",
  failed: "bg-red-400",
  refunded: "bg-zinc-400",
};

function getPrimaryAction(status: string): { label: string; nextStatus: string | null; done?: boolean } {
  if (status === "awaiting_payment") return { label: "Confirmar pago", nextStatus: "paid" };
  if (status === "pending") return { label: "Confirmar pago", nextStatus: "paid" };
  if (status === "paid") return { label: "A preparación", nextStatus: "preparing" };
  if (status === "preparing") return { label: "En despacho", nextStatus: "shipped" };
  if (status === "shipped") return { label: "Entregado", nextStatus: "delivered" };
  if (status === "delivered") return { label: "Listo", nextStatus: null, done: true };
  return { label: "—", nextStatus: null, done: true };
}

function normalizeTelHref(phone: string | null | undefined): string | null {
  const raw = String(phone ?? "").trim();
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("56")) return `tel:+${d}`;
  if (d.length === 9 && d.startsWith("9")) return `tel:+56${d}`;
  return `tel:+${d}`;
}

function normalizePhoneDigits(phone: string | null | undefined): string {
  return String(phone ?? "").replace(/\D/g, "");
}

function formatPhoneDisplay(phone: string | null | undefined): string {
  const raw = String(phone ?? "").trim();
  if (!raw) return "";
  const d = raw.replace(/\D/g, "");
  if (d.length === 9 && d.startsWith("9")) return `+56 ${d.slice(0, 1)} ${d.slice(1, 5)} ${d.slice(5)}`;
  if (d.length === 11 && d.startsWith("56"))
    return `+${d.slice(0, 2)} ${d.slice(2, 3)} ${d.slice(3, 7)} ${d.slice(7)}`;
  return raw;
}

function buildMapsQuery(addr: Record<string, unknown>): string {
  const line1 =
    addr.direccion != null
      ? String(addr.direccion)
      : addr.address != null
        ? String(addr.address)
        : addr.line1 != null
          ? String(addr.line1)
          : "";
  const ciudad = addr.ciudad != null ? String(addr.ciudad) : addr.city != null ? String(addr.city) : "";
  const region = addr.region != null ? String(addr.region) : addr.state != null ? String(addr.state) : "";
  const pais =
    addr.pais != null ? String(addr.pais) : addr.country != null ? String(addr.country) : "Chile";
  return [line1, ciudad, region, pais].filter(Boolean).join(", ").trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function OrderDetail({ order, storeName }: { order: any; storeName: string }) {
  const [currentStatus, setCurrentStatus] = useState<string>(() => normalizeOrderStatusKey(order.status));
  const [status, setStatus] = useState<string>(() => normalizeOrderStatusKey(order.status));
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [formattedDate, setFormattedDate] = useState("");
  const currentOrderStatus = currentStatus;

  const addr = (order.shipping_address ?? {}) as Record<string, unknown>;
  const telHref = normalizeTelHref(order.customer_phone as string | null | undefined);
  const phoneDigits = normalizePhoneDigits(order.customer_phone as string | null | undefined);
  const customerName = String(order.customer_name ?? "").trim() || "cliente";
  const whatsappMessage = `Hola ${customerName}, soy de ${storeName}.\n\nTe escribo por tu pedido ${order.display_code ?? `#${order.order_number}`}.\n\nYa lo estamos preparando.\n\n¿Estarás disponible para la entrega hoy?`;
  const whatsappHref =
    phoneDigits.length > 0
      ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(whatsappMessage)}`
      : "";
  const mapsQuery = buildMapsQuery(addr);
  const hasAddressForMaps = Boolean(
    addr.direccion ??
      addr.address ??
      addr.line1 ??
      addr.ciudad ??
      addr.city ??
      addr.region ??
      addr.state
  );
  const googleMapsHref =
    mapsQuery.length > 0 && hasAddressForMaps
      ? `https://www.google.com/maps?q=${encodeURIComponent(mapsQuery)}`
      : "";

  const line1 = String(addr.direccion ?? addr.address ?? addr.line1 ?? "").trim();
  const cityRegion = [addr.ciudad ?? addr.city, addr.region ?? addr.state].filter(Boolean).join(", ").trim();
  const pais = String(addr.pais ?? addr.country ?? "Chile").trim();
  const addressCompact = [line1, cityRegion, pais].filter(Boolean).join(" · ");

  const phoneDisplay = formatPhoneDisplay(order.customer_phone as string | null | undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = Array.isArray(order.items) ? order.items : [];
  const persisted = getOrderPersistedTotals(order as Record<string, unknown>);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    setFormattedDate(
      new Date(order.created_at).toLocaleDateString("es-CL", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  }, [order.created_at]);

  async function handleCopyPhone() {
    if (!phoneDigits) return;
    try {
      await navigator.clipboard.writeText(phoneDigits);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 1500);
    } catch {
      toast.error("No se pudo copiar el número.");
    }
  }

  async function handleSave(nextStatus: string) {
    if (nextStatus === currentOrderStatus) return;
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await updateOrderStatusAction(order.id, nextStatus as any);
      if (result.error) {
        toast.error(result.error);
      } else {
        setCurrentStatus(nextStatus);
        setStatus(nextStatus);
        toast.success("Estado actualizado correctamente.");
      }
    } finally {
      setSaving(false);
    }
  }

  const primaryAction = getPrimaryAction(currentOrderStatus);
  const canCancel = currentOrderStatus !== "delivered" && currentOrderStatus !== "cancelled";
  const hasManualChanges = status !== currentOrderStatus;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/admin/pedidos"
          className="flex shrink-0 items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver
        </Link>

        <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="font-display text-lg font-bold text-zinc-900">{order.display_code ?? `#${order.order_number}`}</h1>
          <span className="hidden text-xs text-zinc-400 sm:inline">
            {formattedDate}
          </span>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              STATUS_CLS[currentOrderStatus] ?? "bg-zinc-100 text-zinc-500 border-zinc-200"
            }`}
          >
            <span
              className={`h-1 w-1 rounded-full ${STATUS_DOT[currentOrderStatus] ?? "bg-zinc-400"}`}
            />
            {formatOrderStatus(currentOrderStatus)}
          </span>
        </div>
      </div>

      <OrderTimeline status={currentOrderStatus} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        {/* Cliente / entrega */}
        <section className="flex min-h-0 flex-col rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-zinc-100 px-3 py-2">
            <MapPin className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
            <h2 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Cliente · entrega
            </h2>
          </div>
          <div className="flex flex-1 flex-col gap-2.5 p-3">
            {order.customer_name ? (
              <p className="text-base font-bold leading-snug text-zinc-900">{order.customer_name}</p>
            ) : (
              <p className="text-sm text-zinc-400">Sin nombre</p>
            )}

            {telHref ? (
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={telHref}
                  className="text-lg font-bold tabular-nums text-zinc-900 underline decoration-zinc-200 underline-offset-2 hover:text-zinc-700"
                >
                  {phoneDisplay || order.customer_phone}
                </a>
                {isMobile ? (
                  <a
                    href={telHref}
                    className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-zinc-900 px-2.5 text-[11px] font-semibold text-white hover:bg-zinc-700"
                  >
                    Llamar
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={handleCopyPhone}
                    className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white px-2.5 text-[11px] font-semibold text-zinc-800 hover:bg-zinc-50"
                  >
                    {copiedPhone ? "Copiado" : "Copiar número"}
                  </button>
                )}
                {whatsappHref ? (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-[11px] font-semibold text-white hover:bg-emerald-700"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span className="leading-none">Contactar cliente</span>
                    <span className="block text-[10px] font-medium leading-none text-emerald-100">vía WhatsApp</span>
                  </a>
                ) : null}
              </div>
            ) : order.customer_phone ? (
              <p className="text-lg font-bold text-zinc-900">{order.customer_phone}</p>
            ) : null}

            {order.customer_email ? (
              <a
                href={`mailto:${order.customer_email}`}
                className="truncate text-[11px] text-zinc-500 hover:text-zinc-800 hover:underline"
                title={order.customer_email}
              >
                {order.customer_email}
              </a>
            ) : null}

            {addressCompact ? (
              <p className="text-xs font-medium leading-snug text-zinc-800">{addressCompact}</p>
            ) : (
              <p className="text-xs text-zinc-400">Sin dirección</p>
            )}

            {googleMapsHref ? (
              <a
                href={googleMapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 w-fit items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 px-2.5 text-[11px] font-semibold text-zinc-800 hover:bg-zinc-100"
              >
                Google Maps
              </a>
            ) : null}
          </div>
        </section>

        {/* Gestión + totales */}
        <section className="flex min-h-0 flex-col rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-zinc-100 px-3 py-2">
            <Workflow className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
            <h2 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Gestión
            </h2>
          </div>
          <div className="flex flex-1 flex-col gap-2 p-3">
            <span
              className={`inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                STATUS_CLS[currentOrderStatus] ?? "bg-zinc-100 text-zinc-500 border-zinc-200"
              }`}
            >
              <span
                className={`h-1 w-1 rounded-full ${STATUS_DOT[currentOrderStatus] ?? "bg-zinc-400"}`}
              />
              {formatOrderStatus(currentOrderStatus)}
            </span>

            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="h-8 w-full appearance-none rounded-md border border-zinc-300 bg-white pl-2 pr-7 text-xs text-zinc-900 outline-none focus:ring-1 focus:ring-zinc-900"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              </div>
              <button
                type="button"
                onClick={() => handleSave(status)}
                disabled={saving || !hasManualChanges}
                className="h-8 shrink-0 rounded-md bg-zinc-900 px-3 text-[11px] font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "…" : "Guardar"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {primaryAction.nextStatus ? (
                <button
                  type="button"
                  onClick={() => handleSave(primaryAction.nextStatus!)}
                  disabled={saving}
                  className="h-8 rounded-md border border-zinc-300 bg-white px-2.5 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-40"
                >
                  {primaryAction.label}
                </button>
              ) : null}
              {canCancel ? (
                <button
                  type="button"
                  onClick={() => handleSave("cancelled")}
                  disabled={saving}
                  className="h-8 rounded-md px-2.5 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  Cancelar
                </button>
              ) : null}
            </div>

            <div className="mt-auto space-y-1 border-t border-zinc-100 pt-2 text-[11px] text-zinc-600">
              <div className="flex justify-between gap-2">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatPrice(persisted.subtotal)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Envío</span>
                <span className="tabular-nums">
                  {persisted.shipping_cost === 0 ? "Gratis" : formatPrice(persisted.shipping_cost)}
                </span>
              </div>
              <div className="flex justify-between gap-2 font-bold text-zinc-900">
                <span>Total</span>
                <span className="tabular-nums">{formatPrice(persisted.total)}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Productos · ancho completo */}
      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-zinc-100 px-3 py-2">
          <Package className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
          <h2 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Productos
          </h2>
          <span
            className={`ml-auto inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${
              order.stock_discounted === true
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-zinc-200 bg-zinc-50 text-zinc-500"
            }`}
            title={
              order.stock_discounted === true
                ? "El stock ya fue descontado al confirmarse el pago."
                : "Aún no se descuenta stock (pendiente de pago o sin confirmar)."
            }
          >
            <span
              className={`h-1 w-1 rounded-full ${
                order.stock_discounted === true ? "bg-emerald-500" : "bg-zinc-400"
              }`}
            />
            {order.stock_discounted === true ? "Stock descontado" : "Stock no descontado"}
          </span>
        </div>
        <div className="p-3">
          {items.length === 0 ? (
            <p className="text-xs text-zinc-400">Sin productos registrados.</p>
          ) : (
            <div className="flex flex-col divide-y divide-zinc-100">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {items.map((item: any, i: number) => (
                <div key={i} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image}
                        alt={item.name ?? "Producto"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-4 w-4 text-zinc-300" strokeWidth={1} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {item.name ?? "Producto"}
                    </p>
                    {item.variant ? (
                      <p className="truncate text-[10px] text-zinc-400">{item.variant}</p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {formatPrice(Math.round(Number(item.unit_price ?? item.price) || 0))} ×{" "}
                      {item.quantity ?? 1}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-zinc-900">
                    {formatPrice(getPersistedLineAmount(item as Record<string, unknown>))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
