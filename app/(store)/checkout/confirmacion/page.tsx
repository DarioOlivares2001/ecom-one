"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { useCartStore } from "@/lib/cart/store";
import { Button } from "@/components/ui/Button";
import { pixelEvents } from "@/lib/pixel/events";

const PIXEL_PURCHASE_SENT_PREFIX = "meta_purchase_sent_";

const POST_COMPRA_STORAGE = "cuenta_postcompra";
const POST_COMPRA_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_MS = 25000;

type PaymentStatus = "loading" | "paid" | "failed";

// ─── Icons ────────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.05 }}
      className="flex h-24 w-24 items-center justify-center rounded-full bg-green-50 ring-8 ring-green-100"
    >
      <svg viewBox="0 0 52 52" className="h-12 w-12" aria-hidden>
        <motion.circle
          cx="26" cy="26" r="24"
          fill="none" stroke="#16a34a" strokeWidth="2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        />
        <motion.path
          fill="none" stroke="#16a34a" strokeWidth="3.5"
          strokeLinecap="round" strokeLinejoin="round"
          d="M14 27l8 8 16-16"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.35, delay: 0.38, ease: "easeOut" }}
        />
      </svg>
    </motion.div>
  );
}

function ErrorIcon() {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.05 }}
      className="flex h-24 w-24 items-center justify-center rounded-full bg-red-50 ring-8 ring-red-100"
    >
      <svg viewBox="0 0 52 52" className="h-12 w-12" aria-hidden>
        <motion.circle
          cx="26" cy="26" r="24"
          fill="none" stroke="#dc2626" strokeWidth="2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        />
        <motion.path
          fill="none" stroke="#dc2626" strokeWidth="3.5"
          strokeLinecap="round" strokeLinejoin="round"
          d="M17 17 l18 18 M35 17 l-18 18"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.35, delay: 0.38, ease: "easeOut" }}
        />
      </svg>
    </motion.div>
  );
}

// ─── Loading ──────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <main className="flex min-h-[82vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--color-background)] ring-8 ring-[var(--color-border)]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-primary)]" />
      </div>
      <p className="mt-8 font-semibold text-[var(--color-text)]">Estamos verificando tu pago…</p>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Puede tardar unos segundos. No cierres esta página.
      </p>
    </main>
  );
}

// ─── Meta Pixel: Purchase del navegador (complementario al de servidor) ────────

/**
 * Dispara Purchase una sola vez por orden, aunque se recargue la página de
 * gracias — se marca en sessionStorage antes de disparar. Usa display_code
 * como event_id, el mismo que usa el servidor (lib/pixel/capi.ts) para que
 * Meta deduplique Pixel + CAPI. El value lo calcula pixelEvents.purchase con
 * sumProductsValue a partir de los ítems reales (sin envío).
 */
function firePurchaseOnce(data: {
  displayCode?: string | null;
  items?: Array<{ product_id?: string; price?: number; quantity?: number }>;
}) {
  const eventId = data.displayCode?.trim();
  if (!eventId) return;

  const storageKey = `${PIXEL_PURCHASE_SENT_PREFIX}${eventId}`;
  try {
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, "1");
  } catch {
    // sessionStorage no disponible (modo privado, etc.): igual disparamos.
    // Preferible un duplicado ocasional a perder el evento por completo.
  }

  const orderItems = Array.isArray(data.items) ? data.items : [];
  const contentIds = orderItems
    .map((i) => i?.product_id)
    .filter((id): id is string => Boolean(id));

  pixelEvents.purchase({
    contentIds,
    items: orderItems.map((i) => ({
      price: Number(i?.price) || 0,
      quantity: Number(i?.quantity) || 0,
    })),
    orderId: eventId,
    eventId,
  });
}

// ─── Main content ─────────────────────────────────────────────────────────────

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const order = searchParams.get("order");
  const display = searchParams.get("display") || order;

  const clearRef = useRef(false);
  const clear = useCartStore((s) => s.clear);

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("loading");
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [waPhone, setWaPhone] = useState("");
  const [waEnabled, setWaEnabled] = useState(false);

  // Read customer email from sessionStorage
  useEffect(() => {
    if (!order) { setCustomerEmail(null); return; }
    try {
      const raw = sessionStorage.getItem(POST_COMPRA_STORAGE);
      if (!raw) { setCustomerEmail(null); return; }
      const d = JSON.parse(raw) as { order?: string; email?: string; t?: number };
      if (d.order !== order || !d.email) { setCustomerEmail(null); return; }
      if (typeof d.t === "number" && Date.now() - d.t > POST_COMPRA_MAX_AGE_MS) {
        setCustomerEmail(null); return;
      }
      setCustomerEmail(d.email);
    } catch {
      setCustomerEmail(null);
    }
  }, [order]);

  // Verifica estado real con polling: awaiting_payment → sigue polleando,
  // paid → éxito (limpia carrito), cualquier otro estado → fallo inmediato.
  useEffect(() => {
    if (!order) { setPaymentStatus("failed"); return; }

    const controller = new AbortController();
    const startTime = Date.now();
    let pollTimeout: ReturnType<typeof setTimeout>;

    // WA config: se carga una sola vez en paralelo, no bloquea el polling.
    fetch("/api/checkout/whatsapp-config", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { enableWhatsappCheckout?: boolean; supportWhatsapp?: string } | null) => {
        if (d?.enableWhatsappCheckout && d.supportWhatsapp) {
          setWaEnabled(true);
          setWaPhone(d.supportWhatsapp);
        }
      })
      .catch(() => {});

    async function poll() {
      if (controller.signal.aborted) return;
      try {
        const res = await fetch(
          `/api/orders/status?order=${encodeURIComponent(order!)}`,
          { signal: controller.signal, cache: "no-store" }
        );

        if (!res.ok) { setPaymentStatus("failed"); return; }

        const data = (await res.json()) as {
          status?: string;
          displayCode?: string | null;
          items?: Array<{ product_id?: string; price?: number; quantity?: number }>;
        };
        const { status } = data;

        if (status === "paid") {
          if (!clearRef.current) { clearRef.current = true; clear(); }
          setPaymentStatus("paid");
          firePurchaseOnce(data);
          return;
        }

        // Estado terminal distinto a paid (cancelled, rejected, etc.) → fallo inmediato.
        if (status !== "awaiting_payment") {
          setPaymentStatus("failed");
          return;
        }

        // Sigue en awaiting_payment: reintentar si no agotamos el tiempo.
        if (Date.now() - startTime >= POLL_MAX_MS) {
          // Posible cancelación voluntaria que Flow no notificó por webhook.
          // Verificamos con Flow usando el flow_token guardado en BD (no el
          // status que reporte el cliente) antes de marcar la orden cancelled.
          if (order) {
            fetch("/api/orders/cancel-if-unpaid", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ order }),
            }).catch(() => {});
          }
          setPaymentStatus("failed");
          return;
        }

        pollTimeout = setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (!controller.signal.aborted) setPaymentStatus("failed");
      }
    }

    poll();
    return () => { controller.abort(); clearTimeout(pollTimeout); };
  }, [order, clear]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (paymentStatus === "loading") return <LoadingState />;

  // ── Payment failed ─────────────────────────────────────────────────────────
  if (paymentStatus === "failed") {
    const waMsg = `Hola, tuve un problema con mi pago para el pedido ${display ?? order ?? ""}. ¿Pueden ayudarme?`;
    const waUrl =
      waEnabled && waPhone
        ? `https://wa.me/${waPhone.replace(/\D/g, "")}?text=${encodeURIComponent(waMsg)}`
        : null;

    return (
      <main className="flex min-h-[82vh] flex-col items-center justify-center px-4 py-16 text-center">
        <ErrorIcon />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4, ease: "easeOut" }}
          className="mt-8 flex flex-col items-center gap-5"
        >
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl">
            No pudimos confirmar tu pago
          </h1>

          <p className="max-w-sm leading-relaxed text-[var(--color-text-muted)]">
            Flow no completó el cobro. Tu pedido no fue procesado y nada fue
            descontado de tu cuenta.
          </p>

          <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
            <Link href="/checkout">
              <Button size="lg">Volver al checkout</Button>
            </Link>

            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-md)] border border-[#1e9e51] bg-gradient-to-b from-[#2adf72] to-[#22c55e] px-5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5"
              >
                <MessageCircle className="h-4 w-4" />
                Pedir ayuda por WhatsApp
              </a>
            )}
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-12 text-xs text-[var(--color-text-muted)]"
        >
          Si el problema persiste, contáctanos y te ayudamos.
        </motion.p>
      </main>
    );
  }

  // ── Payment confirmed ──────────────────────────────────────────────────────
  return (
    <main className="flex min-h-[82vh] flex-col items-center justify-center px-4 py-16 text-center">
      <CheckIcon />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4, ease: "easeOut" }}
        className="mt-8 flex flex-col items-center gap-5"
      >
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl">
          ¡Pedido confirmado!
        </h1>

        {display && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3.5">
            <p className="text-xs font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
              Código de pedido
            </p>
            <p className="mt-0.5 font-mono font-display text-xl font-bold text-[var(--color-text)]">
              {display}
            </p>
          </div>
        )}

        <p className="max-w-xs leading-relaxed text-[var(--color-text-muted)]">
          Te enviaremos los detalles a tu email en los próximos minutos.
        </p>

        {customerEmail && order && (
          <div className="mt-2 w-full max-w-md rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 text-left shadow-sm">
            <p className="text-sm font-medium text-[var(--color-text)]">
              Crea tu cuenta y recibe descuentos exclusivos en tus próximas compras
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Es opcional: tu compra ya está confirmada con o sin cuenta.
            </p>
            <Link
              href={`/cuenta/crear?email=${encodeURIComponent(customerEmail)}&order=${encodeURIComponent(order)}`}
              className="mt-4 inline-flex w-full justify-center"
            >
              <Button type="button" size="lg" fullWidth variant="secondary">
                Crear mi cuenta
              </Button>
            </Link>
          </div>
        )}

        <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/productos">
            <Button size="lg">Seguir comprando</Button>
          </Link>
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="mt-12 text-xs text-[var(--color-text-muted)]"
      >
        Pago procesado de forma segura por Flow Chile
      </motion.p>
    </main>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConfirmacionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--color-text-muted)]">
          Cargando…
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}
