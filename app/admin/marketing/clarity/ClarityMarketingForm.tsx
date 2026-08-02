"use client";

import { useTransition, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "@/components/ui/Toast";
import type { StoreSettingsView } from "@/lib/store-settings/getStoreSettings";
import type { SaveClarityResult } from "./page";

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

export function ClarityMarketingForm({
  settings,
  action,
}: {
  settings: StoreSettingsView;
  action: (formData: FormData) => Promise<SaveClarityResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const projectId = settings.clarity_project_id.trim();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Configuración de Clarity guardada correctamente.");
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
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">Microsoft Clarity</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Mapas de calor y grabaciones de sesión, 100% gratis y sin límite de tráfico. Solo un script — sin
          eventos que disparar ni API de servidor. Se carga únicamente en la tienda pública, nunca en el admin.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <StatusPill
          ok={settings.clarity_enabled}
          label={settings.clarity_enabled ? "Clarity habilitado" : "Clarity deshabilitado"}
        />
        <StatusPill ok={Boolean(projectId)} label={projectId ? "Project ID configurado" : "Sin Project ID"} />
      </div>

      {projectId ? (
        <a
          href={`https://clarity.microsoft.com/projects/view/${encodeURIComponent(projectId)}/dashboard`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          Abrir panel de Clarity ↗
        </a>
      ) : (
        <p className="text-xs text-zinc-500">Guarda un Project ID para ver el enlace directo al panel.</p>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
      >
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="clarity_enabled"
            value="true"
            defaultChecked={settings.clarity_enabled}
            className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
          />
          Microsoft Clarity habilitado
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-700">Project ID</span>
          <input
            type="text"
            name="clarity_project_id"
            defaultValue={settings.clarity_project_id}
            placeholder="abcdefghij"
            autoComplete="off"
            className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <span className="text-xs text-zinc-500">
            Lo encuentras en Clarity → Settings → Setup, dentro del snippet de instalación.
          </span>
        </label>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Guardando…" : "Guardar Clarity"}
          </button>
        </div>
      </form>
    </div>
  );
}
