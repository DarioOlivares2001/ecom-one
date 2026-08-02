import { Check, Package } from "lucide-react";
import { normalizeOrderStatusKey } from "@/lib/orders/formatOrderStatus";

const STEPS = [
  { title: "Pedido recibido", desc: "Recibimos tu orden." },
  { title: "Pago confirmado", desc: "El pago fue acreditado." },
  { title: "Preparando pedido", desc: "Empaquetamos tu compra." },
  { title: "En camino", desc: "Salió hacia tu dirección." },
  { title: "Entregado", desc: "Pedido completado." },
] as const;

const STATUS_ORDER = ["pending", "paid", "preparing", "shipped", "delivered"] as const;

function currentIndex(status: string): number {
  const s = normalizeOrderStatusKey(status);
  if (s === "cancelled" || s === "failed" || s === "refunded") return -1;
  const key = s === "processing" ? "preparing" : s;
  const i = (STATUS_ORDER as readonly string[]).indexOf(key);
  return i >= 0 ? i : 0;
}

type StepVisual = "done" | "current" | "upcoming";

function stepVisual(stepIndex: number, status: string): StepVisual {
  const s = normalizeOrderStatusKey(status);
  if (s === "cancelled" || s === "failed" || s === "refunded") return "upcoming";
  if (s === "delivered") return "done";
  const idx = currentIndex(status);
  if (stepIndex < idx) return "done";
  if (stepIndex === idx) return "current";
  return "upcoming";
}

/** Línea bajo el paso i hacia el siguiente: verde si ese tramo ya quedó superado. */
function lineAfterStepComplete(stepIndex: number, status: string): boolean {
  const s = normalizeOrderStatusKey(status);
  if (s === "delivered") return true;
  if (s === "cancelled" || s === "failed" || s === "refunded") return false;
  const ci = currentIndex(status);
  return stepIndex < ci;
}

export function SeguimientoTimeline({ status }: { status: string }) {
  const s = normalizeOrderStatusKey(status);
  if (s === "cancelled") {
    return (
      <div
        className="rounded-[var(--radius-md)] border border-[var(--color-error)]/25 bg-[var(--color-error)]/6 p-4"
        role="status"
      >
        <p className="text-sm font-semibold text-[var(--color-error)]">Pedido cancelado</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
          Este pedido fue cancelado y no continúa en el flujo de envío.
        </p>
      </div>
    );
  }
  if (s === "failed") {
    return (
      <div
        className="rounded-[var(--radius-md)] border border-[var(--color-error)]/25 bg-[var(--color-error)]/6 p-4"
        role="status"
      >
        <p className="text-sm font-semibold text-[var(--color-error)]">Pedido fallido</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
          Este pedido no pudo completarse. Si tienes dudas, contáctanos.
        </p>
      </div>
    );
  }
  if (s === "refunded") {
    return (
      <div
        className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background)] p-4"
        role="status"
      >
        <p className="text-sm font-semibold text-[var(--color-text)]">Reembolsado</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
          El monto correspondiente fue reembolsado según tu medio de pago.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
      <h2 className="font-display text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
        Estado del envío
      </h2>
      <ol className="mt-5">
        {STEPS.map((step, i) => {
          const visual = stepVisual(i, status);
          const isLast = i === STEPS.length - 1;
          const connectorDone = lineAfterStepComplete(i, status);

          return (
            <li key={step.title} className="relative flex gap-3 sm:gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    visual === "done"
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : visual === "current"
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/12 text-[var(--color-primary)] ring-4 ring-[var(--color-primary)]/15"
                        : "border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-muted)]",
                  ].join(" ")}
                  aria-current={visual === "current" ? "step" : undefined}
                >
                  {visual === "done" ? (
                    <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                  ) : visual === "current" ? (
                    <Package className="h-4 w-4" strokeWidth={2} aria-hidden />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-[var(--color-border)]" aria-hidden />
                  )}
                </div>
                {!isLast ? (
                  <div
                    className={[
                      "w-0.5 flex-1 min-h-[1.25rem] my-0.5",
                      connectorDone ? "bg-emerald-500/85" : "bg-[var(--color-border)]",
                    ].join(" ")}
                    aria-hidden
                  />
                ) : null}
              </div>
              <div className={`min-w-0 flex-1 ${isLast ? "" : "pb-2"}`}>
                <p
                  className={[
                    "text-sm font-semibold",
                    visual === "upcoming" ? "text-[var(--color-text-muted)]" : "text-[var(--color-text)]",
                  ].join(" ")}
                >
                  {step.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-text-muted)]">{step.desc}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
