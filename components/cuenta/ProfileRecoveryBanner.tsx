"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CuentaLinkButton } from "@/components/cuenta/CuentaLinkButton";

export type RecoverySnapshot = {
  nombre: string;
  telefono: string;
  direccion: string;
  comuna: string;
  region: string;
  pais: string;
};

export function ProfileRecoveryBanner({
  storeName,
  snapshot,
}: {
  storeName: string;
  snapshot: RecoverySnapshot;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const brand = (storeName || "la tienda").trim() || "la tienda";

  async function handleConfirm() {
    setLoading(true);
    try {
      const r = await fetch("/api/cuenta/profile-recovery/ack", { method: "POST" });
      if (r.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const hasAddr = Boolean(
    snapshot.direccion?.trim() || snapshot.comuna?.trim() || snapshot.region?.trim()
  );

  return (
    <section
      className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-primary)]/25 bg-gradient-to-br from-[var(--color-primary)]/[0.08] via-[var(--color-surface)] to-[var(--color-background)] p-5 shadow-sm sm:p-6"
      aria-labelledby="recovery-title"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 gap-3">
          <span
            className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/12 text-[var(--color-primary)]"
            aria-hidden
          >
            <Sparkles className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h2 id="recovery-title" className="font-display text-lg font-bold text-[var(--color-text)] sm:text-xl">
              Ya eras cliente de {brand}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
              Encontramos datos de tus compras anteriores. Confírmalos para comprar más rápido la próxima vez.
            </p>
            <dl
              className="mt-4 space-y-2 rounded-[var(--radius-md)] border border-[var(--color-border)]/80 bg-[var(--color-background)]/90 px-3.5 py-3 text-sm"
              data-clarity-mask="true"
            >
              {snapshot.nombre?.trim() ? (
                <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                  <dt className="shrink-0 font-medium text-[var(--color-text-muted)]">Nombre</dt>
                  <dd className="min-w-0 text-[var(--color-text)]">{snapshot.nombre}</dd>
                </div>
              ) : null}
              {snapshot.telefono?.trim() ? (
                <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                  <dt className="shrink-0 font-medium text-[var(--color-text-muted)]">Teléfono</dt>
                  <dd className="min-w-0 text-[var(--color-text)]">{snapshot.telefono}</dd>
                </div>
              ) : null}
              {hasAddr ? (
                <div className="flex flex-col gap-0.5">
                  <dt className="font-medium text-[var(--color-text-muted)]">Dirección</dt>
                  <dd className="text-[var(--color-text)]">
                    {[snapshot.direccion, snapshot.comuna, snapshot.region].filter(Boolean).join(" · ")}
                    {snapshot.pais?.trim() ? ` · ${snapshot.pais}` : ""}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
      </div>
      <div className="mt-5 flex w-full flex-col gap-2.5 sm:mt-6 sm:flex-row sm:justify-end sm:gap-3">
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="sm:min-w-[180px]"
          loading={loading}
          onClick={handleConfirm}
        >
          Confirmar datos
        </Button>
        <CuentaLinkButton
          href="/cuenta/datos"
          variant="secondary"
          className="w-full sm:w-auto sm:min-w-[180px]"
        >
          Editar datos
        </CuentaLinkButton>
      </div>
      {hasAddr ? (
        <p className="mt-3 text-center text-xs text-[var(--color-text-muted)] sm:text-right">
          <Link
            href="/cuenta/direcciones"
            className="font-medium text-[var(--color-primary)] underline underline-offset-2 hover:opacity-90"
          >
            Ver o editar direcciones guardadas
          </Link>
        </p>
      ) : null}
    </section>
  );
}
