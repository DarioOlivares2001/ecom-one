import { LayoutGrid, Package, TrendingUp } from "lucide-react";
import { AdminLoginForm } from "./AdminLoginForm";

interface AdminLoginScreenProps {
  /** Ya resuelto en servidor con el fallback "Tienda" — nunca vacío. */
  storeName: string;
  /** Ya validado en servidor con `isAllowedImageSrc` (local o R2) — null si no hay logo o no es seguro. */
  logoUrl: string | null;
}

const BENEFITS = [
  { icon: Package, label: "Pedidos" },
  { icon: LayoutGrid, label: "Catálogo" },
  { icon: TrendingUp, label: "Control de ventas" },
] as const;

/**
 * Pantalla de acceso admin — Server Component puro (sin `"use client"`):
 * todo lo que hay acá es texto/markup estático derivado de props ya
 * saneadas. La única parte interactiva (el `<form>` con el submit real) es
 * `AdminLoginForm`, que no recibe ni necesita ningún dato de `store_settings`.
 *
 * Colores: no se pasan como props — se reutiliza el mismo sistema de
 * variables CSS de marca que ya inyecta `app/layout.tsx` (`--brand-gradient`,
 * `--brand-primary`, `--color-surface`, etc., ver
 * `lib/store-settings/buildThemeCssProperties.ts`), disponible en toda la
 * app. Si la tienda no configuró nada, ese mismo sistema cae al preset
 * "deep_violet" (marfil/gris cálido + grafito + violeta profundo) — el
 * estilo neutral sofisticado pedido no es un caso especial, es el default.
 */
export function AdminLoginScreen({ storeName, logoUrl }: AdminLoginScreenProps) {
  const monogram = storeName.trim().charAt(0).toUpperCase() || "T";

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      {/* ── Panel de identidad — completo en desktop, franja compacta en mobile ── */}
      <div className="relative flex shrink-0 flex-col overflow-hidden bg-[#16161d] px-6 py-8 text-white sm:px-10 lg:w-[45%] lg:justify-center lg:px-16 lg:py-14">
        {/* Decoración 100% CSS: glow de marca + patrón de puntos abstracto — sin imágenes externas ni assets. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(60% 50% at 12% 8%, color-mix(in srgb, var(--brand-primary) 60%, transparent) 0%, transparent 70%), radial-gradient(55% 45% at 92% 92%, color-mix(in srgb, var(--brand-accent) 50%, transparent) 0%, transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        <div className="relative flex items-center gap-3 lg:absolute lg:left-16 lg:top-14">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={storeName}
              className="h-9 w-9 shrink-0 rounded-lg bg-white/10 object-contain p-1"
            />
          ) : (
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ background: "var(--brand-gradient)" }}
              aria-hidden
            >
              {monogram}
            </span>
          )}
          <span className="text-sm font-semibold tracking-wide text-white/90">{storeName}</span>
        </div>

        <div className="relative mt-8 lg:mt-0">
          <h1 className="font-display text-[1.6rem] font-bold leading-[1.15] tracking-tight text-white sm:text-3xl lg:text-[2.5rem]">
            Bienvenido al panel
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70 lg:text-base">
            Gestiona productos, pedidos y ventas desde un solo lugar.
          </p>

          {/* Desktop: lista vertical de beneficios */}
          <ul className="mt-8 hidden flex-col gap-3 lg:flex">
            {BENEFITS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-white/85">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                </span>
                {label}
              </li>
            ))}
          </ul>

          {/* Mobile: fila compacta de chips, no ocupa altura extra */}
          <ul className="mt-5 flex flex-wrap gap-2 lg:hidden">
            {BENEFITS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/85"
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Tarjeta de acceso ── */}
      <div className="flex flex-1 items-center justify-center bg-[var(--color-background)] px-4 py-8 sm:px-8 sm:py-10">
        <div className="w-full max-w-sm">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)] sm:p-8">
            <AdminLoginForm />
          </div>
          <p className="mt-6 text-center text-xs text-[var(--color-text-muted)]">
            Acceso exclusivo para administradores.
          </p>
        </div>
      </div>
    </div>
  );
}
