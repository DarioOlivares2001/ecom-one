"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { z } from "zod";
import { clsx } from "clsx";
import { Lock, ChevronDown, ShoppingBag, ArrowLeft, Truck, MessageCircle } from "lucide-react";
import { useCartStore, type CartItem, cartItemNeedsVariantFix } from "@/lib/cart/store";
import { pixelEvents } from "@/lib/pixel/events";
import { formatPrice } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { CheckoutRecommendations } from "@/components/store/CheckoutRecommendations";
import { SHOW_CART_UPSELLS } from "@/lib/config/features";
import {
  buildWhatsAppCartUrl,
  buildWhatsAppOrderMessage,
  normalizeWhatsAppDigits,
} from "@/lib/cart/whatsappCartOrder";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Prefijo fijo Chile móvil WhatsApp; el usuario completa 8 dígitos después del 9. */
const CHILE_WA_PREFIX = "+56 9";
const CHILE_WA_DEFAULT = `${CHILE_WA_PREFIX} `;

function extractEightMobileSuffixDigits(allDigits: string): string {
  const d = allDigits.replace(/\D/g, "");
  if (d.startsWith("569")) return d.slice(3, 11);
  if (d.startsWith("56") && d.length >= 3 && d[2] === "9") return d.slice(3, 11);
  if (d.startsWith("9")) return d.slice(1, 9);
  if (!d.startsWith("5")) return d.slice(0, 8);
  return "";
}

function formatChileWhatsAppFromSuffix(suffixDigits: string): string {
  const b = suffixDigits.replace(/\D/g, "").slice(0, 8);
  if (b.length === 0) return CHILE_WA_DEFAULT;
  if (b.length <= 4) return `${CHILE_WA_PREFIX} ${b}`;
  return `${CHILE_WA_PREFIX} ${b.slice(0, 4)} ${b.slice(4)}`;
}

function chileWhatsAppDisplayFromRawInput(raw: string): string {
  const suffix = extractEightMobileSuffixDigits(raw);
  return formatChileWhatsAppFromSuffix(suffix);
}

function normalizeStoredPhoneForInput(raw: string): string {
  const t = raw.trim();
  if (!t) return CHILE_WA_DEFAULT;
  const compact = t.replace(/\s+/g, " ").trim();
  const mob = chileWhatsAppDisplayFromRawInput(compact);
  if (/^569\d{8}$/.test(mob.replace(/\D/g, ""))) return mob;
  return compact.slice(0, 40);
}

// Sin uso mientras la región esté fija a FIXED_REGION (cobertura local). Se deja
// intacta para el clon a otros nichos: volver a recorrerla en el <FormSelect> de región.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CHILE_REGIONS = [
  "Arica y Parinacota",
  "Tarapacá",
  "Antofagasta",
  "Atacama",
  "Coquimbo",
  "Valparaíso",
  "Metropolitana de Santiago",
  "Libertador General Bernardo O'Higgins",
  "Maule",
  "Ñuble",
  "Biobío",
  "La Araucanía",
  "Los Ríos",
  "Los Lagos",
  "Aysén del General Carlos Ibáñez del Campo",
  "Magallanes y de la Antártica Chilena",
] as const;

/** Cobertura inicial: comunas por región (select dependiente). Otras regiones usan comuna en texto libre. */
const COMMUNES_BY_REGION: Record<string, readonly string[]> = {
  "Libertador General Bernardo O'Higgins": ["Rancagua", "Machalí", "Graneros"],
  "Metropolitana de Santiago": [
    "Santiago",
    "Providencia",
    "Las Condes",
    "Ñuñoa",
    "Maipú",
    "Puente Alto",
    "La Florida",
  ],
};

/**
 * Cobertura fija de esta versión de PonkyBonk (tienda local, solo O'Higgins).
 * Para clonar a otro nicho a nivel nacional: volver a mostrar el <FormSelect>
 * de región (recorriendo CHILE_REGIONS, que se deja sin uso pero intacto más
 * abajo) y cambiar el estado inicial del form de `region: FIXED_REGION` a
 * `region: ""`.
 */
const FIXED_REGION = "Libertador General Bernardo O'Higgins" as const;
const ALLOWED_COMMUNES: readonly string[] = COMMUNES_BY_REGION[FIXED_REGION] ?? [];

function regionHasCommuneSelect(region: string): boolean {
  return Object.prototype.hasOwnProperty.call(COMMUNES_BY_REGION, region);
}

/** Mock/API puede devolver URL absoluta con host obsoleto; Flow debe seguir en flow.cl. */
function resolvePaymentRedirectUrl(redirectUrl: unknown): string {
  const raw = String(redirectUrl ?? "").trim();
  if (typeof window === "undefined") return raw || "/checkout/confirmacion";
  if (!raw) return `${window.location.origin}/checkout/confirmacion`;
  if (raw.startsWith("/")) return `${window.location.origin}${raw}`;
  if (!raw.startsWith("http")) return `${window.location.origin}/${raw.replace(/^\//, "")}`;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    const isFlowHost = host === "flow.cl" || host.endsWith(".flow.cl");
    if (isFlowHost) return raw;
    const pathAndQuery = u.pathname + u.search;
    if (pathAndQuery.startsWith("/checkout/confirmacion")) {
      return `${window.location.origin}${pathAndQuery}`;
    }
  } catch {
    return raw;
  }
  return raw;
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

const schema = z
  .object({
    email: z.string().email("Email inválido"),
    name: z.string().min(3, "Ingresa tu nombre completo"),
    phone: z
      .string()
      .refine(
        (val) => /^569\d{8}$/.test(val.replace(/\D/g, "")),
        "Ingresa 8 dígitos después del +56 9"
      ),
    address: z.string().min(5, "Ingresa tu dirección completa"),
    city: z.string().min(2, "Ingresa comuna o ciudad"),
    region: z.string().min(1, "Selecciona una región"),
    referencia: z.string().max(300),
  })
  .superRefine((data, ctx) => {
    const list = COMMUNES_BY_REGION[data.region];
    if (!list?.length) return;
    if (!list.includes(data.city)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecciona una comuna",
        path: ["city"],
      });
    }
  });

type FormData = z.infer<typeof schema>;
type FormErrors = Partial<Record<keyof FormData, string>>;

// ─── Envío gratis (gamificación) ──────────────────────────────────────────────

function FreeShippingProgressCard({
  subtotal,
  freeShippingThreshold,
}: {
  subtotal: number;
  freeShippingThreshold: number;
}) {
  const hasFreeShipping = subtotal >= freeShippingThreshold;
  const remaining = Math.max(0, freeShippingThreshold - subtotal);
  const progressPct = hasFreeShipping
    ? 100
    : Math.min(100, (subtotal / freeShippingThreshold) * 100);

  return (
    <motion.div
      layout
      className="rounded-[var(--radius-md)] border border-[var(--color-border)]/90 bg-gradient-to-br from-[var(--color-primary)]/[0.07] via-[var(--color-surface)] to-[var(--color-background)] px-3.5 py-3 shadow-sm"
    >
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-base"
          aria-hidden
        >
          🚚
        </span>
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            {hasFreeShipping ? (
              <motion.div
                key="unlocked"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="space-y-1"
              >
                <p className="text-sm font-semibold leading-snug text-[var(--color-text)]">
                  🎉 ¡Tienes envío GRATIS en este pedido!
                </p>
                <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
                  🚚 Disfruta tu beneficio
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="locked"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="space-y-1"
              >
                <p className="text-sm font-semibold leading-snug text-[var(--color-text)]">
                  🚚 Te faltan {formatPrice(remaining)} para envío GRATIS
                </p>
                <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
                  💡 Agrega un producto más y ahorra el envío
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]/55"
            role="progressbar"
            aria-valuenow={Math.round(progressPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={
              hasFreeShipping
                ? "Envío gratis desbloqueado"
                : `Progreso hacia envío gratis: ${Math.round(progressPct)} por ciento`
            }
          >
            <motion.div
              aria-hidden
              className="h-full rounded-full bg-brand-gradient shadow-[0_0_12px_rgba(255,255,255,0.12)]"
              initial={false}
              animate={{ width: `${progressPct}%` }}
              transition={{ type: "spring", stiffness: 280, damping: 34, mass: 0.75 }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Styled select ────────────────────────────────────────────────────────────

function FormSelect({
  label,
  error,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-sm font-medium text-[var(--color-text)]">
          {label}
        </label>
      )}
      <select
        className={clsx(
          "h-10 w-full rounded-[var(--radius-sm)] border bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] transition-shadow outline-none",
          "focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]",
          "disabled:opacity-50",
          error
            ? "border-[var(--color-error)] focus:ring-[var(--color-error)]"
            : "border-[var(--color-border)]"
        )}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p className="text-xs text-[var(--color-error)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Order summary content ────────────────────────────────────────────────────

function OrderSummaryContent({
  items,
  subtotal,
  shippingCost,
  total,
  totalSavings,
  savingsPercent,
  freeShippingThreshold,
}: {
  items: CartItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  totalSavings: number;
  savingsPercent: number | null;
  freeShippingThreshold: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <FreeShippingProgressCard subtotal={subtotal} freeShippingThreshold={freeShippingThreshold} />

      {/* Items */}
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={`${item.product_id}-${item.variant_id ?? item.variant ?? ""}`} className="flex gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-background)] border border-[var(--color-border)]">
              {item.image ? (
                <Image src={item.image} alt={item.name} fill className="object-cover" sizes="56px" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-[var(--color-border)]" strokeWidth={1} />
                </div>
              )}
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-text-muted)] text-[9px] font-bold text-white">
                {item.quantity}
              </span>
            </div>
            <div className="flex flex-1 flex-col justify-center min-w-0">
              <p className="truncate text-sm font-medium text-[var(--color-text)]">{item.name}</p>
              {item.variant && (
                <p className="text-xs text-[var(--color-text-muted)]">{item.variant}</p>
              )}
            </div>
            <p className="shrink-0 text-sm font-semibold text-[var(--color-text)]">
              {formatPrice(item.price * item.quantity)}
            </p>
          </li>
        ))}
      </ul>

      <div className="border-t border-[var(--color-border)] pt-4 flex flex-col gap-2">
        <div className="flex justify-between text-sm text-[var(--color-text-muted)]">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
            <Truck className="h-3.5 w-3.5" />
            Envío
          </span>
          {shippingCost === 0 ? (
            <span className="font-medium text-[var(--color-success)]">Gratis</span>
          ) : (
            <span className="text-[var(--color-text-muted)]">{formatPrice(shippingCost)}</span>
          )}
        </div>
      </div>

      <div className="border-t border-[var(--color-border)] pt-3 flex justify-between items-baseline">
        <span className="text-base font-semibold text-[var(--color-text)]">Total</span>
        <span className="text-xl font-bold text-[var(--color-text)]">{formatPrice(total)}</span>
      </div>
      {totalSavings > 0 && (
        <p className="text-sm font-extrabold text-[#16a34a]">
          {savingsPercent && savingsPercent > 0
            ? `💸 Ahorraste ${formatPrice(totalSavings)} (${savingsPercent}% en total)`
            : `💸 Ahorraste ${formatPrice(totalSavings)} en este pedido`}
        </p>
      )}
    </div>
  );
}

// ─── Checkout page ────────────────────────────────────────────────────────────

type CheckoutClientProps = {
  /** Costo de envío configurado en /admin/configuracion (CLP). Fuente: store_settings. */
  shippingCostClp: number;
  /** Umbral de envío gratis configurado en /admin/configuracion (CLP). Fuente: store_settings. */
  freeShippingThresholdClp: number;
};

export function CheckoutClient({ shippingCostClp, freeShippingThresholdClp }: CheckoutClientProps) {
  const { items, total: cartTotal } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormData>({
    email: "",
    name: "",
    phone: CHILE_WA_DEFAULT,
    address: "",
    city: "",
    region: FIXED_REGION,
    referencia: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [waCfg, setWaCfg] = useState<{
    loaded: boolean;
    supportWhatsapp: string;
    enableWhatsappCheckout: boolean;
  }>({ loaded: false, supportWhatsapp: "", enableWhatsappCheckout: false });
  const checkoutPrefillDone = useRef(false);
  const [cuentaLoggedIn, setCuentaLoggedIn] = useState(false);
  const [saveShippingToCuenta, setSaveShippingToCuenta] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (checkoutPrefillDone.current) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/cuenta/checkout-prefill", { cache: "no-store" });
        if (!r.ok || cancelled) return;
        const j = (await r.json()) as {
          loggedIn?: boolean;
          cliente?: { name: string; email: string; phone: string };
          defaultAddress?: {
            address: string;
            city: string;
            region: string;
            referencia?: string;
          } | null;
        };
        if (!j.loggedIn || !j.cliente || cancelled) return;
        checkoutPrefillDone.current = true;
        setCuentaLoggedIn(true);
        setForm((prev) => ({
          ...prev,
          email: prev.email.trim() ? prev.email : j.cliente!.email,
          name: prev.name.trim() ? prev.name : j.cliente!.name,
          phone: j.cliente!.phone?.trim()
            ? normalizeStoredPhoneForInput(j.cliente!.phone)
            : prev.phone.replace(/\D/g, "").length > 3
              ? chileWhatsAppDisplayFromRawInput(prev.phone)
              : CHILE_WA_DEFAULT,
          ...(j.defaultAddress
            ? {
                address: prev.address.trim() ? prev.address : j.defaultAddress.address,
                // La región queda fija (cobertura solo O'Higgins): el prefill nunca la pisa,
                // aunque la dirección guardada del cliente sea de otra región.
                city: prev.city.trim()
                  ? prev.city
                  : ALLOWED_COMMUNES.includes(j.defaultAddress.city)
                    ? j.defaultAddress.city
                    : "",
                referencia: prev.referencia.trim()
                  ? prev.referencia
                  : (j.defaultAddress.referencia ?? ""),
              }
            : {}),
        }));
      } catch {
        // sin prefill
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/checkout/whatsapp-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setWaCfg({
          loaded: true,
          supportWhatsapp: typeof data.supportWhatsapp === "string" ? data.supportWhatsapp : "",
          enableWhatsappCheckout: data.enableWhatsappCheckout === true,
        });
      })
      .catch(() => {
        if (!cancelled) setWaCfg((prev) => ({ ...prev, loaded: true }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const subtotal = cartTotal();
  const shippingCost = subtotal >= freeShippingThresholdClp ? 0 : shippingCostClp;
  const total = subtotal + shippingCost;
  const cartNeedsVariantFix = useMemo(() => items.some(cartItemNeedsVariantFix), [items]);
  const { totalSavings, savingsPercent } = useMemo(() => {
    let savings = 0;
    let totalOriginal = 0;
    for (const item of items) {
      const priceComparative = item.originalPrice;
      if (typeof priceComparative === "number" && priceComparative > item.price) {
        savings += (priceComparative - item.price) * item.quantity;
        totalOriginal += priceComparative * item.quantity;
      }
    }
    const percent = totalOriginal > 0 ? Math.round((savings / totalOriginal) * 100) : null;
    return { totalSavings: savings, savingsPercent: percent };
  }, [items]);

  const waDigits = useMemo(
    () => normalizeWhatsAppDigits(waCfg.supportWhatsapp),
    [waCfg.supportWhatsapp]
  );

  const whatsappCheckoutUrl = useMemo(() => {
    if (!waCfg.loaded || !waCfg.enableWhatsappCheckout || !waDigits || items.length === 0) {
      return null;
    }
    const msg = buildWhatsAppOrderMessage(items, total);
    return buildWhatsAppCartUrl(waDigits, msg);
  }, [waCfg.loaded, waCfg.enableWhatsappCheckout, waDigits, items, total]);

  if (!mounted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <ShoppingBag className="h-12 w-12 text-[var(--color-text-muted)]" strokeWidth={1} />
        <p className="font-semibold text-[var(--color-text)]">Tu carrito está vacío</p>
        <Link href="/productos">
          <Button variant="secondary">Ver productos</Button>
        </Link>
      </div>
    );
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = chileWhatsAppDisplayFromRawInput(e.target.value);
    setForm((prev) => ({ ...prev, phone: next }));
    if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
  }

  function handleChange(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const result = schema.safeParse(form);
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof FormData;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      const firstErrorField = document.querySelector("[aria-invalid='true']");
      firstErrorField?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setLoading(true);
    try {
      if (items.some(cartItemNeedsVariantFix)) {
        toast.error(
          "Elimina el producto afectado y vuelve a agregarlo desde su ficha eligiendo la variante (peso, tamaño, etc.)."
        );
        return;
      }

      pixelEvents.initiateCheckout(items);

      if (saveShippingToCuenta && cuentaLoggedIn) {
        try {
          const sr = await fetch("/api/cuenta/checkout-save-shipping", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: result.data.name,
              phone: result.data.phone,
              address: result.data.address,
              city: result.data.city,
              region: result.data.region,
            }),
          });
          if (!sr.ok) {
            toast.error("No se guardaron los datos en tu cuenta; seguirás al pago con lo ingresado aquí.");
          }
        } catch {
          toast.error("No se guardaron los datos en tu cuenta; seguirás al pago con lo ingresado aquí.");
        }
      }

      const payloadItems = items.map((i) => ({
        product_id: i.product_id,
        variant_id: i.variant_id ?? null,
        quantity: i.quantity,
        name: i.name,
        price: i.price,
        image: i.image,
        variant: i.variant,
        source: i.source === "upsell" ? "upsell" : undefined,
        applied_discount_percent: i.applied_discount_percent ?? i.discountPercent,
        expected_unit_price: i.expected_unit_price,
        isUpsellOffer: i.isUpsellOffer === true,
        discountPercent: i.discountPercent,
      }));

      if (process.env.NODE_ENV === "development") {
        console.log("checkout submit total", {
          subtotal,
          shippingCost,
          total,
          items: items.map((i) => ({
            product_id: i.product_id,
            variant_id: i.variant_id ?? null,
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.price,
            lineTotal: Math.round(i.price * i.quantity),
            isUpsellOffer: Boolean(i.isUpsellOffer),
            source: i.source,
          })),
        });
      }

      const res = await fetch("/api/flow/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: result.data,
          items: payloadItems,
          subtotal,
          shippingCost,
          total,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Error al procesar el pago. Intenta nuevamente.");
        return;
      }

      const finalUrl = resolvePaymentRedirectUrl(data.redirectUrl);

      try {
        const u = new URL(finalUrl);
        const ord = u.searchParams.get("order");
        if (ord && result.data.email) {
          sessionStorage.setItem(
            "cuenta_postcompra",
            JSON.stringify({
              order: ord,
              email: result.data.email,
              name: result.data.name,
              t: Date.now(),
            })
          );
        }
      } catch {
        // ignorar si la URL de retorno no es parseable
      }

      window.location.href = finalUrl;
    } catch {
      toast.error("Error de conexión. Verifica tu internet e intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)]">

      {/* ── Mobile summary bar ── */}
      <div className="lg:hidden sticky top-24 z-30 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setSummaryOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3"
          aria-expanded={summaryOpen}
        >
          <span className="flex items-center gap-2 text-sm font-medium text-[var(--color-text)]">
            <ShoppingBag className="h-4 w-4" />
            {summaryOpen ? "Ocultar" : "Ver"} resumen del pedido
            <ChevronDown
              className={clsx(
                "h-4 w-4 text-[var(--color-text-muted)] transition-transform duration-200",
                summaryOpen && "rotate-180"
              )}
            />
          </span>
          <span className="font-bold text-[var(--color-text)]">{formatPrice(total)}</span>
        </button>

        <AnimatePresence initial={false}>
          {summaryOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="border-t border-[var(--color-border)] px-4 py-4">
                <OrderSummaryContent
                  items={items}
                  subtotal={subtotal}
                  shippingCost={shippingCost}
                  total={total}
                  totalSavings={totalSavings}
                  savingsPercent={savingsPercent}
                  freeShippingThreshold={freeShippingThresholdClp}
                />
                {SHOW_CART_UPSELLS && (
                  <CheckoutRecommendations
                    subtotal={subtotal}
                    freeShippingThreshold={freeShippingThresholdClp}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Main content ── */}
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:grid lg:grid-cols-[1fr_380px] lg:gap-16 lg:px-8 lg:py-12">

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">

          {cartNeedsVariantFix ? (
            <div
              role="alert"
              className="rounded-[var(--radius-md)] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            >
              <p className="font-semibold">Hay productos sin variante elegida</p>
              <p className="mt-1 text-amber-900/90">
                Elimina este producto y vuelve a agregarlo desde la ficha.
              </p>
              <ul className="mt-2 space-y-2">
                {items.filter(cartItemNeedsVariantFix).map((item) => (
                  <li key={`${item.product_id}-${item.variant ?? "x"}`} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.name}</span>
                    <Link
                      href={item.product_slug ? `/productos/${item.product_slug}` : "/productos"}
                      className="inline-flex rounded-md bg-amber-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-900"
                    >
                      Corregir
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Back link */}
          <Link
            href="/carrito"
            className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al carrito
          </Link>

          {/* Contact — data-clarity-mask: nombre/email/teléfono nunca se suben a Clarity */}
          <section className="flex flex-col gap-4" data-clarity-mask="true">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">
              Datos de contacto
            </h2>
            <Input
              label="Email"
              type="email"
              placeholder="tu@email.com"
              autoComplete="email"
              value={form.email}
              onChange={handleChange("email")}
              error={errors.email}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Nombre completo"
                type="text"
                placeholder="Juan Pérez"
                autoComplete="name"
                value={form.name}
                onChange={handleChange("name")}
                error={errors.name}
              />
              <Input
                label="Teléfono WhatsApp"
                type="tel"
                inputMode="numeric"
                placeholder="1234 5678"
                autoComplete="tel"
                value={form.phone}
                onChange={handlePhoneChange}
                error={errors.phone}
              />
            </div>
          </section>

          {/* Shipping — data-clarity-mask: dirección/comuna/región/referencia nunca se suben a Clarity */}
          <section className="flex flex-col gap-4" data-clarity-mask="true">
            <h2 className="font-display text-lg font-bold text-[var(--color-text)]">
              Datos para coordinar tu entrega
            </h2>
            <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
              No necesitas crear una cuenta. Usaremos estos datos solo para confirmar tu pedido y coordinar el despacho.
            </p>
            {cuentaLoggedIn ? (
              <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
                Si tenías una dirección principal, rellenamos el formulario. Puedes cambiar los datos solo para este
                pedido. Para actualizar tu cuenta, marca la opción de abajo o edita en «Mis direcciones».
              </p>
            ) : null}

            <Input
              label="Región"
              value={FIXED_REGION}
              disabled
              helperText="Por ahora despachamos solo en la Región de O'Higgins."
            />

            {regionHasCommuneSelect(form.region) ? (
              <FormSelect
                label="Comuna o ciudad"
                required
                value={form.city}
                onChange={handleChange("city")}
                error={errors.city}
                disabled={!form.region}
                autoComplete="address-level2"
              >
                <option value="" disabled>
                  {!form.region ? "Primero selecciona tu región" : "Selecciona comuna…"}
                </option>
                {(COMMUNES_BY_REGION[form.region] ?? []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </FormSelect>
            ) : (
              <Input
                label="Comuna o ciudad"
                type="text"
                placeholder="Ej. Viña del Mar"
                autoComplete="address-level2"
                value={form.city}
                onChange={handleChange("city")}
                error={errors.city}
                disabled={!form.region}
              />
            )}

            <Input
              label="Dirección"
              type="text"
              placeholder="Calle, número, depto/torre"
              autoComplete="street-address"
              value={form.address}
              onChange={handleChange("address")}
              error={errors.address}
            />
            <Input
              label="Referencia (opcional)"
              type="text"
              placeholder="Torre, color de portón, indicaciones para el reparto…"
              autoComplete="off"
              value={form.referencia}
              onChange={handleChange("referencia")}
              error={errors.referencia}
            />

            {cuentaLoggedIn ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)]/90 bg-[var(--color-surface)] px-3.5 py-3 text-sm text-[var(--color-text)]">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                  checked={saveShippingToCuenta}
                  onChange={(e) => setSaveShippingToCuenta(e.target.checked)}
                />
                <span className="leading-snug">
                  Guardar estos datos para próximas compras (actualiza tu perfil y dirección principal en la cuenta).
                </span>
              </label>
            ) : null}
          </section>

          {/* CTA */}
          <section className="flex flex-col gap-3">
            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={loading}
              disabled={cartNeedsVariantFix}
              className="bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/90 active:bg-[var(--color-accent)]/80 gap-2"
            >
              <Lock className="h-4 w-4" />
              Pagar con Flow — {formatPrice(total)}
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              <Lock className="h-3 w-3" />
              Pago 100% seguro con cifrado SSL. Aceptamos WebPay, tarjetas y transferencia.
            </p>
            {whatsappCheckoutUrl && (
              <a
                href={whatsappCheckoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[#1e9e51] bg-gradient-to-b from-[#2adf72] to-[#22c55e] px-4 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(34,197,94,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:from-[#30e779] hover:to-[#20bd59] hover:shadow-[0_14px_28px_rgba(34,197,94,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e]/45"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/18 ring-1 ring-white/30">
                  <MessageCircle className="h-3.5 w-3.5" />
                </span>
                Coordinar pedido por WhatsApp
              </a>
            )}
          </section>
        </form>

        {/* ── Desktop summary ── */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <h2 className="font-display text-base font-bold text-[var(--color-text)] mb-5">
              Resumen del pedido
            </h2>
            <OrderSummaryContent
              items={items}
              subtotal={subtotal}
              shippingCost={shippingCost}
              total={total}
              totalSavings={totalSavings}
              savingsPercent={savingsPercent}
              freeShippingThreshold={freeShippingThresholdClp}
            />
            {SHOW_CART_UPSELLS && (
              <CheckoutRecommendations
                subtotal={subtotal}
                freeShippingThreshold={freeShippingThresholdClp}
              />
            )}
            <Button
              type="button"
              size="lg"
              fullWidth
              loading={loading}
              disabled={cartNeedsVariantFix}
              onClick={handleSubmit as unknown as React.MouseEventHandler}
              className="mt-5 bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/90 gap-2"
            >
              <Lock className="h-4 w-4" />
              Pagar con Flow
            </Button>
            {whatsappCheckoutUrl && (
              <a
                href={whatsappCheckoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[#1e9e51] bg-gradient-to-b from-[#2adf72] to-[#22c55e] px-4 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(34,197,94,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:from-[#30e779] hover:to-[#20bd59] hover:shadow-[0_14px_28px_rgba(34,197,94,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e]/45"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/18 ring-1 ring-white/30">
                  <MessageCircle className="h-3.5 w-3.5" />
                </span>
                Coordinar pedido por WhatsApp
              </a>
            )}
          </div>
        </aside>

      </div>
    </div>
  );
}
