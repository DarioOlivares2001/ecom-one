import type { Metadata } from "next";
import { getPublicOrderByDisplayCode } from "@/lib/orders/getPublicOrderByNumber";
import { getCuentaSessionFromCookies } from "@/lib/cuenta/session";
import { SeguimientoLookupForm } from "@/components/store/seguimiento/SeguimientoLookupForm";
import { SeguimientoNotFound } from "@/components/store/seguimiento/SeguimientoNotFound";
import { SeguimientoOrderView } from "@/components/store/seguimiento/SeguimientoOrderView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Seguimiento de pedido",
  description: "Consulta el estado de tu pedido con tu código de seguimiento.",
};

function parseOrderQuery(raw: string | string[] | undefined): "missing" | "invalid" | string {
  if (raw == null) return "missing";
  const s = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = (s ?? "").trim().toUpperCase();
  if (!trimmed) return "missing";
  if (/^SO\d+$/.test(trimmed)) return trimmed;
  return "invalid";
}

function parseEmailQuery(raw: string | string[] | undefined): string | null {
  if (raw == null) return null;
  const s = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = (s ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default async function SeguimientoPage({
  searchParams,
}: {
  searchParams: { order?: string | string[]; email?: string | string[] };
}) {
  const session = getCuentaSessionFromCookies();
  const parsed = parseOrderQuery(searchParams.order);

  // ── Código ausente o inválido → mostrar formulario ────────────────────────
  if (parsed === "missing") {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col justify-center px-4 py-12">
        <SeguimientoLookupForm
          requiresEmail={!session}
          showMisPedidosLink={!!session}
        />
      </main>
    );
  }

  if (parsed === "invalid") {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col justify-center px-4 py-12">
        <SeguimientoLookupForm
          invalidCode
          requiresEmail={!session}
          showMisPedidosLink={!!session}
        />
      </main>
    );
  }

  // ── Código válido — verificar propiedad ───────────────────────────────────
  if (session) {
    const order = await getPublicOrderByDisplayCode(parsed, session.email);

    if (!order) {
      return (
        <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col justify-center px-4 py-12">
          <SeguimientoNotFound displayCode={parsed} />
        </main>
      );
    }

    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
        <SeguimientoOrderView order={order} />
      </main>
    );
  }

  // Sin sesión: requerir email como campo adicional
  const emailParam = parseEmailQuery(searchParams.email);

  if (!emailParam) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col justify-center px-4 py-12">
        <SeguimientoLookupForm
          requiresEmail
          prefillOrderCode={parsed}
          showMisPedidosLink={false}
        />
      </main>
    );
  }

  const order = await getPublicOrderByDisplayCode(parsed, emailParam);

  if (!order) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col justify-center px-4 py-12">
        <SeguimientoNotFound displayCode={parsed} />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <SeguimientoOrderView order={order} />
    </main>
  );
}
