import Link from "next/link";
import { Instagram, Music2, ShieldCheck } from "lucide-react";
import type { StoreSettingsView } from "@/lib/store-settings/getStoreSettings";

type FooterNavLink = {
  label: string;
  href: string;
  external?: boolean;
};

const NAV_LINKS: FooterNavLink[] = [
  { label: "Nosotros", href: "/nosotros" },
  { label: "Productos", href: "/productos" },
  { label: "Seguimiento de pedido", href: "/seguimiento" },
];

const PAYMENT_BADGES = [
  "WebPay Plus",
  "Visa",
  "Mastercard",
  "Transferencia bancaria",
];

const LEGAL_LINKS = [
  { label: "Política de privacidad", href: "/politica-privacidad" },
  { label: "Términos y condiciones", href: "/terminos" },
  { label: "Política de devoluciones", href: "/devoluciones" },
];

export function Footer({ settings }: { settings: StoreSettingsView }) {
  const instagramUrl = settings.support_instagram || "https://instagram.com";
  const tiktokUrl = settings.support_tiktok || "https://tiktok.com";
  const whatsappPhone = settings.support_whatsapp || "56900000000";
  const whatsappHref = `https://wa.me/${whatsappPhone.replace(/[^\d]/g, "")}`;
  const footerBg = settings.footer_background_color || "#111111";
  const footerText = settings.footer_text_color || "#FFFFFF";

  return (
    <footer style={{ backgroundColor: footerBg, color: footerText }}>
      {/* ── Main grid ── */}
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8 lg:gap-16">

          {/* ── Col 1: Brand ── */}
          <div className="flex flex-col gap-5">
            <Link href="/" className="flex w-fit items-center gap-2">
              {settings.logo_square_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.logo_square_url}
                  alt={settings.store_name}
                  className="h-8 w-8 rounded-md object-cover"
                />
              ) : null}
              <span
                className="text-2xl"
                style={{
                  color: footerText,
                  fontFamily: "var(--font-heading)",
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                }}
              >
                {settings.store_name}
              </span>
            </Link>
            <p className="text-sm leading-relaxed opacity-80">
              {settings.store_tagline}<br />Entrega rápida en Rancagua y alrededores.
            </p>
            <div className="flex items-center gap-4">
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="transition-colors hover:opacity-100"
                style={{ color: footerText, opacity: 0.7 }}
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href={tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
                className="transition-colors hover:opacity-100"
                style={{ color: footerText, opacity: 0.7 }}
              >
                <Music2 className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* ── Col 2: Info links ── */}
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold uppercase tracking-widest opacity-70">
              Información
            </p>
            <ul className="flex flex-col gap-3">
              {NAV_LINKS.map(({ label, href, external }) => (
                <li key={href}>
                  {external ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm transition-colors hover:opacity-100"
                      style={{ color: footerText, opacity: 0.8 }}
                    >
                      {label}
                    </a>
                  ) : (
                    <Link
                      href={href}
                      className="text-sm transition-colors hover:opacity-100"
                      style={{ color: footerText, opacity: 0.8 }}
                    >
                      {label}
                    </Link>
                  )}
                </li>
              ))}
              <li>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm transition-colors hover:opacity-100"
                  style={{ color: footerText, opacity: 0.8 }}
                >
                  Contacto WhatsApp
                </a>
              </li>
            </ul>
          </div>

          {/* ── Col 3: Payments ── */}
          <div className="flex flex-col gap-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest opacity-70">
              <ShieldCheck className="h-3.5 w-3.5" />
              Pagos seguros con
            </p>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_BADGES.map((badge) => (
                <span
                  key={badge}
                  className="rounded-md border px-2.5 py-1 text-xs font-medium"
                  style={{
                    borderColor: "color-mix(in oklab, currentColor 30%, transparent)",
                    backgroundColor: "color-mix(in oklab, currentColor 8%, transparent)",
                    color: footerText,
                    opacity: 0.9,
                  }}
                >
                  {badge}
                </span>
              ))}
            </div>
            <p className="text-xs opacity-65">Procesado por Flow Chile</p>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div
        className="border-t"
        style={{ borderColor: "color-mix(in oklab, currentColor 24%, transparent)" }}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 sm:px-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p className="text-xs opacity-65">
            © 2026 {settings.store_name}. Todos los derechos reservados.
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {LEGAL_LINKS.map(({ label, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-xs transition-colors hover:opacity-100"
                  style={{ color: footerText, opacity: 0.7 }}
                >
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs transition-colors hover:opacity-100"
                style={{ color: footerText, opacity: 0.7 }}
              >
                WhatsApp
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
