"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  Package,
  Settings,
  MessageSquareQuote,
  Megaphone,
  Store,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import type { StoreSettingsView } from "@/lib/store-settings/getStoreSettings";

/** Luminancia relativa sRGB (0–1). */
function relativeLuminance(hex: string): number | null {
  const m = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Color de marca legible sobre fondo oscuro del sidebar admin.
 * Si `brand_text_color` / `primary_color` son oscuros o el gradiente global sería poco legible, se usa texto claro fijo.
 */
function adminSidebarBrandNameStyle(settings: StoreSettingsView): CSSProperties | undefined {
  const candidates = [settings.brand_text_color, settings.primary_color, settings.accent_color];
  for (const hex of candidates) {
    const L = relativeLuminance(hex);
    if (L != null && L >= 0.58) {
      return { color: hex };
    }
  }
  return undefined;
}

const NAV = [
  { label: "Dashboard",    href: "/admin/dashboard",      icon: LayoutDashboard },
  { label: "Pedidos",      href: "/admin/pedidos",        icon: ShoppingBag },
  { label: "Clientes",     href: "/admin/clientes",       icon: Users },
  { label: "Productos",    href: "/admin/productos",      icon: Package },
  { label: "Reseñas",      href: "/admin/resenas",        icon: MessageSquareQuote },
  { label: "Marketing",    href: "/admin/marketing",      icon: Megaphone },
  { label: "Configuración",href: "/admin/configuracion",  icon: Settings },
];

function SidebarContent({
  onClose,
  settings,
  adminRole,
}: {
  onClose?: () => void;
  settings: StoreSettingsView;
  adminRole: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => pathname.startsWith(href);

  const brandNameStyle = adminSidebarBrandNameStyle(settings);

  async function handleLogout() {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      // redirigimos de todas formas
    }
    onClose?.();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-64 flex-col bg-zinc-950">
      {/* Logo / marca: contraste fijo sobre oscuro (no usa --brand-gradient de la tienda). */}
      <div className="flex h-16 items-center gap-2 border-b border-zinc-800 px-6">
        <Link
          href="/admin"
          onClick={onClose}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1 pr-1 transition-opacity hover:opacity-95"
        >
          {settings.logo_square_url ? (
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 p-0.5 shadow-inner ring-1 ring-zinc-300/90"
              title={settings.store_name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={settings.logo_square_url}
                alt=""
                className="h-full w-full rounded object-contain"
              />
            </span>
          ) : null}
          <span
            className={clsx(
              "min-w-0 truncate text-lg font-semibold tracking-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.85)]",
              brandNameStyle ? "" : "text-zinc-50"
            )}
            style={brandNameStyle}
          >
            {settings.store_name}
          </span>
        </Link>
        <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 ring-1 ring-zinc-600/80">
          Admin
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-0.5">
          {NAV.map(({ label, href, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={onClose}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive(href)
                    ? "bg-white text-zinc-950"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            </li>
          ))}
          {adminRole === "owner" ? (
            <li>
              <Link
                href="/admin/usuarios"
                onClick={onClose}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive("/admin/usuarios")
                    ? "bg-white text-zinc-950"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                )}
              >
                <Users className="h-4 w-4 shrink-0" />
                Usuarios admin
              </Link>
            </li>
          ) : null}
        </ul>
      </nav>

      {/* Store link */}
      <div className="border-t border-zinc-800 p-3">
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          Cerrar sesión
        </button>
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
        >
          <span className="flex items-center gap-2">
            <Store className="h-3.5 w-3.5" />
            Ver tienda pública
          </span>
          <ExternalLink className="h-3.5 w-3.5 opacity-85" />
        </Link>
      </div>
    </aside>
  );
}

export function AdminSidebar({ settings, adminRole }: { settings: StoreSettingsView; adminRole: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop — fixed */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex">
        <SidebarContent settings={settings} adminRole={adminRole} />
      </div>

      {/* Mobile — hamburger */}
      <button
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950 text-white shadow-lg lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile — drawer */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <div className="relative h-full">
              <button
                onClick={() => setOpen(false)}
                className="absolute -right-10 top-4 flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-white"
                aria-label="Cerrar menú"
              >
                <X className="h-4 w-4" />
              </button>
              <SidebarContent settings={settings} adminRole={adminRole} onClose={() => setOpen(false)} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
