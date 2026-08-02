"use client";

import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { clsx } from "clsx";
import { normalizeWhatsAppDigits, buildWhatsAppCartUrl } from "@/lib/cart/whatsappCartOrder";

const GENERIC_MESSAGE = "Hola, quiero hacer una consulta";

type WhatsAppFabProps = {
  phone: string;
  enabled: boolean;
};

/**
 * Rutas donde no debe aparecer: checkout (no distraer del pago) y carrito
 * (el CTA "Finalizar compra" cae abajo en mobile; el FAB se le encimaría).
 * /admin nunca lo monta (layout separado), así que no necesita chequeo acá.
 */
function isExcludedRoute(pathname: string): boolean {
  return (
    pathname === "/checkout" ||
    pathname.startsWith("/checkout/") ||
    pathname === "/carrito"
  );
}

/** Ficha de producto: StickyAddToCart ocupa la franja inferior en mobile. */
function isProductDetailRoute(pathname: string): boolean {
  return /^\/productos\/[^/]+/.test(pathname);
}

export function WhatsAppFab({ phone, enabled }: WhatsAppFabProps) {
  const pathname = usePathname() ?? "";
  const digits = normalizeWhatsAppDigits(phone);

  if (!enabled || !digits || isExcludedRoute(pathname)) return null;

  const href = buildWhatsAppCartUrl(digits, GENERIC_MESSAGE);
  const isPdp = isProductDetailRoute(pathname);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      className={clsx(
        "fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full",
        "border border-[#1e9e51] bg-gradient-to-b from-[#2adf72] to-[#22c55e] text-white",
        "shadow-[0_10px_22px_rgba(34,197,94,0.35)] transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(34,197,94,0.4)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e]/45",
        "md:right-6 md:bottom-6",
        isPdp ? "bottom-24" : "bottom-5"
      )}
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  );
}
