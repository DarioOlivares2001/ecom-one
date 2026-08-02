"use client";

import { useTransition, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "@/components/ui/Toast";
import type { StoreSettingsView } from "@/lib/store-settings/getStoreSettings";
import type { SaveMetaResult } from "./page";

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        ok ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-zinc-400"}`} />
      {label}
    </span>
  );
}

export function MetaMarketingForm({
  settings,
  action,
}: {
  settings: StoreSettingsView;
  action: (formData: FormData) => Promise<SaveMetaResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const hasToken = Boolean(settings.meta_capi_access_token);
  const isTestMode = Boolean(settings.meta_test_event_code);
  const pixelId = settings.meta_pixel_id.trim();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Configuración de Meta guardada correctamente.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/marketing"
          className="text-sm text-zinc-500 transition-colors hover:text-zinc-700 hover:underline"
        >
          ← Marketing
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">Meta — Pixel &amp; Conversions API</h1>
        <p className="mt-1 text-sm text-zinc-500">
          PageView, ViewContent, AddToCart e InitiateCheckout se envían desde el navegador. Purchase se
          envía desde el servidor (webhook de Flow) para no depender de que el cliente vuelva a la página
          de gracias.
        </p>
      </div>

      {/* Estado de conexión, de un vistazo */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <StatusPill
          ok={settings.meta_pixel_enabled}
          label={settings.meta_pixel_enabled ? "Pixel habilitado" : "Pixel deshabilitado"}
        />
        <StatusPill ok={hasToken} label={hasToken ? "Token CAPI configurado" : "Sin token CAPI"} />
        <StatusPill ok={!isTestMode} label={isTestMode ? "Modo prueba activo" : "Modo producción"} />
      </div>

      {isTestMode && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">⚠️ Modo de prueba activo</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            Todos los eventos de Conversions API se están mandando con el código de prueba{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5">{settings.meta_test_event_code}</code>. Van a
            la pestaña &quot;Test Events&quot; de Meta, no a las métricas normales de campañas. Vacía este
            campo cuando termines de probar.
          </p>
        </div>
      )}

      {/* Accesos directos */}
      {pixelId ? (
        <div className="flex flex-wrap gap-3">
          <a
            href={`https://business.facebook.com/events_manager2/list/pixel/${encodeURIComponent(pixelId)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Abrir Events Manager ↗
          </a>
          <a
            href="https://adsmanager.facebook.com/adsmanager"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Abrir Ads Manager ↗
          </a>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">
          Guarda un Pixel ID para ver el enlace directo a Events Manager.
        </p>
      )}
      {pixelId && (
        <p className="-mt-3 text-xs text-zinc-400">
          Ads Manager no filtra por pixel automáticamente (está organizado por cuenta publicitaria, no por
          pixel) — es el acceso genérico.
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
      >
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="meta_pixel_enabled"
            value="true"
            defaultChecked={settings.meta_pixel_enabled}
            className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
          />
          Meta Pixel habilitado (apaga sin borrar las credenciales de abajo)
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-700">Pixel ID</span>
          <input
            type="text"
            name="meta_pixel_id"
            defaultValue={settings.meta_pixel_id}
            placeholder="123456789012345"
            autoComplete="off"
            className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-700">Código de prueba (opcional)</span>
          <input
            type="text"
            name="meta_test_event_code"
            defaultValue={settings.meta_test_event_code}
            placeholder="TEST12345"
            autoComplete="off"
            className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <span className="text-xs text-zinc-500">
            Del Test Events de Meta Events Manager. Vacío en producción normal.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-700">Conversions API access token</span>
          <input
            type="password"
            name="meta_capi_access_token"
            defaultValue=""
            placeholder={hasToken ? "•••••••••••••• (dejar vacío para no cambiar)" : "Pega el access token"}
            autoComplete="off"
            className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <span className={`text-xs ${hasToken ? "text-emerald-700" : "text-zinc-500"}`}>
            {hasToken
              ? "Token configurado ✓ (por seguridad no se muestra en texto plano; escribe uno nuevo para reemplazarlo)"
              : "Sin configurar. Sin este token, Purchase no se envía por Conversions API aunque el pixel esté habilitado."}
          </span>
        </label>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Guardando…" : "Guardar Meta"}
          </button>
        </div>
      </form>
    </div>
  );
}
