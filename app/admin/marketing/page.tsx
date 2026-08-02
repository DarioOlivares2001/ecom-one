import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getStoreSettings } from "@/lib/store-settings/getStoreSettings";

export const metadata: Metadata = { title: "Marketing" };

type StatusTone = "ok" | "warn" | "off";

const TONE_CLASSNAME: Record<StatusTone, string> = {
  ok: "bg-emerald-100 text-emerald-700",
  warn: "bg-amber-100 text-amber-700",
  off: "bg-zinc-100 text-zinc-500",
};

export default async function MarketingIndexPage() {
  const settings = await getStoreSettings();

  const metaReady =
    settings.meta_pixel_enabled &&
    Boolean(settings.meta_pixel_id.trim()) &&
    Boolean(settings.meta_capi_access_token);

  const clarityReady = settings.clarity_enabled && Boolean(settings.clarity_project_id.trim());

  // Agregar otra plataforma (TikTok Ads, Google Ads) = un objeto más acá,
  // con su propia lógica de estado. La grilla y la card son genéricas.
  const platforms: Array<{
    key: string;
    name: string;
    description: string;
    href: string;
    status: { label: string; tone: StatusTone };
  }> = [
    {
      key: "meta",
      name: "Meta (Facebook / Instagram)",
      description: "Pixel del navegador + Conversions API para campañas de Meta Ads.",
      href: "/admin/marketing/meta",
      status: !settings.meta_pixel_enabled
        ? { label: "Deshabilitado", tone: "off" }
        : metaReady
          ? { label: "Listo para producción", tone: "ok" }
          : { label: "Falta configurar", tone: "warn" },
    },
    {
      key: "clarity",
      name: "Microsoft Clarity",
      description: "Mapas de calor y grabaciones de sesión — ideal para ver dónde abandona el checkout.",
      href: "/admin/marketing/clarity",
      status: !settings.clarity_enabled
        ? { label: "Deshabilitado", tone: "off" }
        : clarityReady
          ? { label: "Listo para producción", tone: "ok" }
          : { label: "Falta configurar", tone: "warn" },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Marketing</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Conecta plataformas de anuncios. Cada una guarda su propia configuración por separado.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {platforms.map((p) => (
          <Link
            key={p.key}
            href={p.href}
            className="group flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:border-zinc-300"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-zinc-900">{p.name}</h2>
              <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="text-sm text-zinc-500">{p.description}</p>
            <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASSNAME[p.status.tone]}`}>
              {p.status.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
